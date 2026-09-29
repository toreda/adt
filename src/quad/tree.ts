import type {QuadTreeBounds} from './tree/bounds';
import {QuadTreeElement} from './tree/element';
import type {QuadTreeError} from './tree/error';
import {QuadTreeIterator} from './tree/iterator';
import type {QuadTreeLocator} from './tree/locator';
import type {QuadTreeMethod} from './tree/method';
import type {QuadTreeOptions} from './tree/options';
import type {QuadTreePoint} from './tree/point';
import type {QuadTreeQuadrant} from './tree/quadrant';
import {ElementPool} from '../element/pool';
import type {ObjectPoolConstructor} from '../object/pool/constructor';
import type {QueryFilter} from '../query/filter';
import type {QueryOptions} from '../query/options';
import type {QueryResult} from '../query/result';
import type {Tree} from '../tree';
import {booleanValue} from '../boolean/value';
import {isNumber, undefinedItemSkip} from '../utility';

/** Shared by every query result: a quadtree has no keys. */
const queryNoKey = (): string | null => null;
/** Shared by every query result: a quadtree has no indexes. */
const queryNoIndex = (): number | null => null;

/**
 * Point quadtree: each node holds one item at a position on the plane, read
 * by a caller supplied locator, and splits the plane around that position
 * into four quadrants (see `QuadTreeQuadrant`). Each quadrant holds a subtree
 * of the items lying in it. The plane is unbounded: any finite position fits.
 *
 * Insert and exact position search take O(depth). Range, radius, and nearest
 * neighbor searches skip every quadrant that cannot hold a match. Every walk
 * is iterative.
 *
 * Node wrappers are pooled by default (see `DataStructureOptions`). Removal
 * and `update()` relink nodes instead of copying values between them, so a
 * node handed out by `insert()` keeps holding its item until that item is
 * removed.
 *
 * Once the pool and the tree's internal scratch arrays have grown, `insert()`,
 * `remove()`, `removeNode()`, `update()`, `find()`, `nearest()`, and
 * `forEach()`, `forEachWithinBounds()`, and `forEachWithinRadius()` allocate
 * nothing. `withinBounds()` and `withinRadius()` allocate their result array,
 * and may still allocate when passed an array to fill (see their `out`
 * parameter); the `forEachWithin*` visitors are the zero-allocation queries.
 *
 * @remarks
 * The tree is not self-balancing: its shape depends on insertion order, so
 * depth ranges from O(log n) for well spread input to O(n) for input sorted
 * along both axes. Removing a node relinks every node in its subtree, which
 * is the conventional point quadtree deletion. It costs O(k * depth) for a
 * subtree of k nodes, and removing the root relinks the whole tree. Removing
 * or moving a leaf relinks nothing.
 *
 * Duplicates are allowed by default: an item at exactly the position of
 * existing ones is placed in their north-east quadrant, below them. With
 * `allowDuplicates: false`, adding a duplicate adds nothing and returns an
 * error code instead of throwing.
 *
 * Each node stores the position its item was filed under, so the tree cannot
 * see an item move after it was inserted. After changing anything the
 * locator reads, call `update()` so the node is moved to the new position.
 *
 * @category Quad Tree
 */
export class QuadTree<ItemT> implements Tree<ItemT, QuadTreeElement<ItemT>> {
	/** Reads item positions. Required at construction, fixed for the tree's lifetime. */
	public readonly locator: QuadTreeLocator<ItemT>;
	/** Whether items at exactly the position of one already in the tree are accepted. */
	public readonly allowDuplicates: boolean;
	/** Whether an undefined item is skipped as a no-op or throws. */
	public readonly allowUndefinedItem: boolean;
	private _root: QuadTreeElement<ItemT> | null;
	private _size: number;
	/** Last id handed to a linked node. Only increases, so ids never repeat. */
	private lastLinkId: number;
	/** Source of node wrappers, pooled or freshly allocated per options. */
	private readonly elements: ElementPool<QuadTreeElement<ItemT>>;
	/**
	 * Node stack reused by every internal walk that runs no caller code
	 * (searches, relinking, traversals). Entries at and above `stackTop` are
	 * null. Indexed instead of pushed and popped, since shrinking an array's
	 * length can free its storage and make the next walk allocate it again.
	 */
	private readonly stackNodes: (QuadTreeElement<ItemT> | null)[];
	/** Number of nodes on `stackNodes`. */
	private stackTop: number;
	/**
	 * Region of each stacked node, four entries per `stackNodes` slot: minX,
	 * minY, maxX, maxY. Used by `nearest()` and `withinRadius()`.
	 */
	private readonly stackRegions: number[];
	/**
	 * Snapshot of the nodes `forEach()` and the `forEachWithin*` visitors
	 * walk, and their link ids. Separate from `stackNodes` because func may
	 * call anything, including another visitor, which stacks its own snapshot
	 * above this one.
	 */
	private readonly eachNodes: (QuadTreeElement<ItemT> | null)[];
	private readonly eachLinkIds: number[];
	/** Number of snapshot entries in use by running `forEach()` and visitor calls. */
	private eachTop: number;
	/** Parent and quadrant found by the last `findSlot()`. */
	private slotParent: QuadTreeElement<ItemT> | null;
	private slotQuadrant: QuadTreeQuadrant;

	/**
	 * @param locator	Reads an item's position. Required, since items are
	 * 					generic and the tree cannot place them itself.
	 * @param data		Items inserted in array order on creation. Any other
	 * 					input is ignored, as are items without a valid position
	 * 					and duplicates when duplicates are not allowed.
	 * @param options	Optional config. Each option falls back to its default
	 * 					when missing or invalid.
	 * @throws			When locator is not a function.
	 */
	constructor(
		locator: QuadTreeLocator<ItemT>,
		data?: ItemT[] | null,
		options?: QuadTreeOptions<ItemT> | null
	) {
		if (typeof locator !== 'function') {
			throw new Error('QuadTree requires a locator function');
		}

		this.locator = locator;
		this.allowDuplicates = booleanValue(true, options?.allowDuplicates);
		this.allowUndefinedItem = booleanValue(true, options?.allowUndefinedItem);
		this._root = null;
		this._size = 0;
		this.lastLinkId = 0;
		// The element class is generic and the pool builds blank nodes with no
		// value, so any ItemT instantiation is valid here.
		this.elements = new ElementPool(
			QuadTreeElement as ObjectPoolConstructor<QuadTreeElement<ItemT>>,
			options
		);
		this.stackNodes = [];
		this.stackTop = 0;
		this.stackRegions = [];
		this.eachNodes = [];
		this.eachLinkIds = [];
		this.eachTop = 0;
		this.slotParent = null;
		this.slotQuadrant = 0;

		if (Array.isArray(data)) {
			this.insertArray(data);
		}
	}

	/**
	 * Iterate items in pre-order, each node before its quadrants. Allocates one
	 * iterator per loop; `forEach()` is the non-allocating walk.
	 *
	 * @remarks
	 * Not safe under mutation. Removal relinks whole subtrees, so removing or
	 * moving items during the loop can skip or repeat items. When the node due
	 * next was removed, iteration ends early. Use `forEach()` to change the
	 * tree while walking it.
	 */
	[Symbol.iterator](): QuadTreeIterator<ItemT> {
		return new QuadTreeIterator<ItemT>(this);
	}

	/**
	 * Insert item at the position its locator returns, as a new leaf, in
	 * O(depth).
	 * @returns		The node now holding item. `invalid_position` when item is
	 * 				undefined (throws instead when `allowUndefinedItem` is
	 * 				`false`; the locator is never called) or when the locator
	 * 				does not return finite x and y coordinates, or
	 * 				`duplicate_not_allowed` when an item already sits at that
	 * 				exact position and duplicates are not allowed. Nothing is
	 * 				added in either case.
	 */
	public insert(item: ItemT): QuadTreeElement<ItemT> | QuadTreeError {
		if (undefinedItemSkip(item, this.allowUndefinedItem, 'QuadTree')) {
			return 'invalid_position';
		}

		const point = this.locator(item);

		if (!this.isPoint(point)) {
			return 'invalid_position';
		}

		const x = point.x;
		const y = point.y;

		// One descent both checks for a duplicate and finds the new leaf's slot.
		if (!this.findSlot(x, y, !this.allowDuplicates)) {
			return 'duplicate_not_allowed';
		}

		// Allocated only once the item is known to be accepted.
		const node = this.createElement(item, x, y);
		this.attach(node);
		++this._size;

		return node;
	}

	/**
	 * Insert each provided item, in array order. Items without a valid
	 * position are skipped, as are items at an occupied position when
	 * duplicates are not allowed.
	 */
	public insertArray(items?: ItemT[] | null): void {
		if (!Array.isArray(items)) {
			return;
		}

		for (let i = 0; i < items.length; i++) {
			this.insert(items[i]);
		}
	}

	/**
	 * Find the node at exactly point, in O(depth). When several items share
	 * that position, returns the one nearest the root.
	 * @returns		Matching node, or null when no item sits at point or point
	 * 				does not have finite x and y coordinates.
	 */
	public find(point: QuadTreePoint): QuadTreeElement<ItemT> | null {
		if (!this.isPoint(point)) {
			return null;
		}

		return this.findAt(point.x, point.y);
	}

	/**
	 * Check whether any item sits at exactly point.
	 */
	public contains(point: QuadTreePoint): boolean {
		return this.find(point) !== null;
	}

	/**
	 * Remove item itself, matched by strict equality like `Set.prototype.delete`.
	 * Only nodes on the search path for the position the locator returns for
	 * item are checked, so an item moved in place must be passed to `update()`
	 * first, or removed with `removeNode()`.
	 * @returns		The removed item, or null when item is not in the tree.
	 */
	public remove(item: ItemT): ItemT | null {
		const point = this.locator(item);

		if (!this.isPoint(point)) {
			return null;
		}

		const x = point.x;
		const y = point.y;
		let curr = this._root;

		while (curr) {
			if (curr._value === item) {
				return this.removeNode(curr);
			}

			curr = curr._children[this.quadrantOf(curr, x, y)];
		}

		return null;
	}

	/**
	 * Unlink node from the tree and return its value. Every node in node's
	 * subtree is relinked from its position, in O(k * depth) for a subtree of
	 * k nodes; a leaf relinks nothing. Those nodes keep their items. With
	 * pooling on, the removed node is recycled and must not be used afterwards.
	 * @returns		The removed value, or null when node is null or not part of
	 * 				this tree (including a node that was already removed).
	 */
	public removeNode(node: QuadTreeElement<ItemT> | null): ItemT | null {
		if (!node || !this.isPartOfTree(node)) {
			return null;
		}

		const value = node._value as ItemT;

		this.detach(node);
		this._size--;
		this.dropNode(node);

		return value;
	}

	/**
	 * Set node's item and move node to the item's position. For an item
	 * changed in place, pass the node's own item: `tree.update(node,
	 * node.value())`. When the position is unchanged, nothing moves. Otherwise
	 * node is unlinked as in `removeNode()` and relinked at the new position.
	 * Moving a leaf relinks no other node.
	 *
	 * @returns		node, which keeps holding item. `invalid_position` when the
	 * 				locator does not return finite x and y coordinates for item,
	 * 				or `duplicate_not_allowed` when another item sits at the new
	 * 				position and duplicates are not allowed: node is removed in
	 * 				both cases and item is no longer in the tree. Null when node
	 * 				is null or not part of this tree; nothing changes then.
	 */
	public update(
		node: QuadTreeElement<ItemT> | null,
		item: ItemT
	): QuadTreeElement<ItemT> | QuadTreeError | null {
		if (!node || !this.isPartOfTree(node)) {
			return null;
		}

		const point = this.locator(item);

		if (!this.isPoint(point)) {
			this.removeNode(node);
			return 'invalid_position';
		}

		node._value = item;

		const x = point.x;
		const y = point.y;

		if (x === node._x && y === node._y) {
			return node;
		}

		this.detach(node);

		// node is out of the tree now, so any match found here is another node.
		if (!this.findSlot(x, y, !this.allowDuplicates)) {
			this._size--;
			this.dropNode(node);
			return 'duplicate_not_allowed';
		}

		node._x = x;
		node._y = y;
		this.attach(node);

		return node;
	}

	/**
	 * Get the topmost node if one exists.
	 * @returns		Root node, or null when the tree is empty.
	 */
	public root(): QuadTreeElement<ItemT> | null {
		return this._root;
	}

	/**
	 * Nodes whose positions lie inside bounds, edges included, in pre-order.
	 * Quadrants lying wholly outside bounds are skipped. Shares its walk with
	 * `forEachWithinBounds()`, so both find the same nodes in the same order.
	 * @param out	Optional array to fill instead of allocating a new one. Its
	 * 				previous contents are replaced and its length set to the
	 * 				match count. The array object is reused, but V8 shrinks its
	 * 				storage when the length drops, so a later call with more
	 * 				matches can allocate storage again. For zero allocation use
	 * 				`forEachWithinBounds()`.
	 * @returns		out when given, otherwise a new array, holding the matching
	 * 				nodes. Empty when bounds has a non-finite value or a min
	 * 				greater than its max.
	 */
	public withinBounds(
		bounds: QuadTreeBounds,
		out?: QuadTreeElement<ItemT>[] | null
	): QuadTreeElement<ItemT>[] {
		const result: QuadTreeElement<ItemT>[] = Array.isArray(out) ? out : [];
		result.length = this.collectWithinBounds(bounds, result, 0);

		return result;
	}

	/**
	 * Call func once for each node whose position lies inside bounds, edges
	 * included, in the order `withinBounds()` returns them (pre-order). The
	 * zero-allocation form of `withinBounds()`: it reuses the tree's scratch
	 * arrays, so once they have grown a call allocates nothing. Visits nothing
	 * when the tree is empty, or bounds has a non-finite value or a min greater
	 * than its max.
	 *
	 * @remarks
	 * Safe under mutation, like `forEach()`: every match is collected before
	 * func first runs, and func is then called over that snapshot. func may
	 * insert, remove, update, or clear: removed matches not yet visited are
	 * skipped, moved matches are still visited once (even when no longer
	 * inside bounds), and inserted items are not visited. func may run any
	 * other query on this tree, including another visitor. When func throws,
	 * the snapshot is released and the error propagates.
	 *
	 * @param func		Called with (element, index, tree). index counts visited
	 * 					matches from 0.
	 * @param thisArg	Value used as `this` when calling func, as passed. Like
	 * 					`Array.prototype.forEach`, `this` is undefined when omitted.
	 * @returns			This tree, like `forEach()`.
	 */
	public forEachWithinBounds(
		bounds: QuadTreeBounds,
		func: QuadTreeMethod<ItemT, void>,
		thisArg?: unknown
	): QuadTree<ItemT> {
		const start = this.eachTop;
		const end = this.collectWithinBounds(bounds, this.eachNodes, start);
		this.visitSnapshot(start, end, func, thisArg);

		return this;
	}

	/**
	 * Nodes whose positions lie within radius of point, boundary included.
	 * Quadrants lying wholly beyond radius are skipped. The quadrant holding
	 * point is searched first, so results are not in pre-order. Shares its
	 * walk with `forEachWithinRadius()`, so both find the same nodes in the
	 * same order.
	 * @param out	Optional array to fill instead of allocating a new one. Its
	 * 				previous contents are replaced and its length set to the
	 * 				match count. The array object is reused, but V8 shrinks its
	 * 				storage when the length drops, so a later call with more
	 * 				matches can allocate storage again. For zero allocation use
	 * 				`forEachWithinRadius()`.
	 * @returns		out when given, otherwise a new array, holding the matching
	 * 				nodes. Empty when point does not have finite x and y
	 * 				coordinates or radius is not a finite number of at least 0.
	 */
	public withinRadius(
		point: QuadTreePoint,
		radius: number,
		out?: QuadTreeElement<ItemT>[] | null
	): QuadTreeElement<ItemT>[] {
		const result: QuadTreeElement<ItemT>[] = Array.isArray(out) ? out : [];
		result.length = this.collectWithinRadius(point, radius, result, 0);

		return result;
	}

	/**
	 * Call func once for each node whose position lies within radius of point,
	 * boundary included, in the order `withinRadius()` returns them (the
	 * quadrant holding point first, not pre-order). The zero-allocation form of
	 * `withinRadius()`: it reuses the tree's scratch arrays, so once they have
	 * grown a call allocates nothing. Visits nothing when the tree is empty,
	 * point does not have finite x and y coordinates, or radius is not a finite
	 * number of at least 0.
	 *
	 * @remarks
	 * Safe under mutation, like `forEach()`: every match is collected before
	 * func first runs, and func is then called over that snapshot. func may
	 * insert, remove, update, or clear: removed matches not yet visited are
	 * skipped, moved matches are still visited once (even when no longer
	 * within radius), and inserted items are not visited. func may run any
	 * other query on this tree, including another visitor. When func throws,
	 * the snapshot is released and the error propagates.
	 *
	 * @param func		Called with (element, index, tree). index counts visited
	 * 					matches from 0.
	 * @param thisArg	Value used as `this` when calling func, as passed. Like
	 * 					`Array.prototype.forEach`, `this` is undefined when omitted.
	 * @returns			This tree, like `forEach()`.
	 */
	public forEachWithinRadius(
		point: QuadTreePoint,
		radius: number,
		func: QuadTreeMethod<ItemT, void>,
		thisArg?: unknown
	): QuadTree<ItemT> {
		const start = this.eachTop;
		const end = this.collectWithinRadius(point, radius, this.eachNodes, start);
		this.visitSnapshot(start, end, func, thisArg);

		return this;
	}

	/**
	 * Node whose position is nearest to point by straight-line distance.
	 * Quadrants that cannot hold anything nearer than the best match so far
	 * are skipped. When several nodes are equally near, returns one of them.
	 * Allocates nothing once the tree's scratch stacks have grown.
	 * @returns		Nearest node, or null when the tree is empty or point does
	 * 				not have finite x and y coordinates.
	 */
	public nearest(point: QuadTreePoint): QuadTreeElement<ItemT> | null {
		if (!this._root || !this.isPoint(point)) {
			return null;
		}

		const px = point.x;
		const py = point.y;
		const regions = this.stackRegions;
		let best: QuadTreeElement<ItemT> | null = null;
		let bestDistance = Infinity;

		this.pushRegion(this._root, -Infinity, -Infinity, Infinity, Infinity);

		while (this.stackTop > 0) {
			const top = this.stackTop - 1;
			const base = top * 4;
			const minX = regions[base];
			const minY = regions[base + 1];
			const maxX = regions[base + 2];
			const maxY = regions[base + 3];
			const node = this.popNode();
			const dx = Math.max(minX - px, 0, px - maxX);
			const dy = Math.max(minY - py, 0, py - maxY);

			if (dx * dx + dy * dy >= bestDistance) {
				continue;
			}

			const distance = this.distanceSquared(node, px, py);

			if (distance < bestDistance) {
				best = node;
				bestDistance = distance;
			}

			this.pushChildRegions(node, px, py, minX, minY, maxX, maxY);
		}

		return best;
	}

	/**
	 * Node after node in pre-order, found by following links in O(depth).
	 * @returns		Next node, or null when node is the last, is null, or is not
	 * 				part of this tree.
	 */
	public preOrderNext(node: QuadTreeElement<ItemT> | null): QuadTreeElement<ItemT> | null {
		if (!node || !this.isPartOfTree(node)) {
			return null;
		}

		return this.nextInPreOrder(node);
	}

	/**
	 * Get number of items in the tree.
	 * @returns		Tree size as a positive integer, or 0 if empty.
	 */
	public size(): number {
		return this._size;
	}

	/**
	 * Quickly check whether the tree has items.
	 */
	public isEmpty(): boolean {
		return this._size === 0;
	}

	/**
	 * Number of edges on the longest root to leaf path, found by following
	 * links in O(n). Allocates nothing.
	 * @returns		Height, 0 for a lone root, or -1 when the tree is empty.
	 */
	public height(): number {
		let node = this._root;
		let depth = 0;
		let height = -1;

		while (node) {
			if (depth > height) {
				height = depth;
			}

			const child = this.firstChild(node, 0);

			if (child) {
				node = child;
				depth++;
				continue;
			}

			// Climb until an ancestor has a later non-empty quadrant.
			let next: QuadTreeElement<ItemT> | null = null;

			while (node._parent) {
				next = this.firstChild(node._parent, node._quadrant + 1);

				if (next) {
					break;
				}

				node = node._parent;
				depth--;
			}

			node = next;
		}

		return height;
	}

	/**
	 * Number of edges between node and the root, in O(depth).
	 * @returns		Depth, 0 for the root, or null when node is null or not part
	 * 				of this tree.
	 */
	public depth(node: QuadTreeElement<ItemT> | null): number | null {
		if (!node || !this.isPartOfTree(node)) {
			return null;
		}

		let depth = 0;
		let curr = node._parent;

		while (curr) {
			depth++;
			curr = curr._parent;
		}

		return depth;
	}

	/**
	 * Create a new tree containing only the items of elements for which func
	 * returns true. The new tree uses this tree's locator and options. Items
	 * are inserted in pre-order, so when every item is kept the new tree has
	 * the same shape as this one.
	 * @param func		Called with (element, index, tree) in pre-order.
	 * @param thisArg	Value used as `this` when calling func, as passed. Like
	 * 					`Array.prototype.filter`, `this` is undefined when omitted.
	 */
	public filter(func: QuadTreeMethod<ItemT, boolean>, thisArg?: unknown): QuadTree<ItemT> {
		const tree = new QuadTree<ItemT>(this.locator, null, this.options());
		tree.insertArray(this.filterValues(func, thisArg));

		return tree;
	}

	/**
	 * Items of elements for which func returns true, in pre-order. Subclasses
	 * build their own `filter()` result from this.
	 */
	protected filterValues(func: QuadTreeMethod<ItemT, boolean>, thisArg?: unknown): ItemT[] {
		const values: ItemT[] = [];

		this.forEach((elem, idx, tree) => {
			if (func.call(thisArg, elem, idx, tree)) {
				values.push(elem._value as ItemT);
			}
		});

		return values;
	}

	/**
	 * Options equivalent to the ones this tree was built with, for creating
	 * derived trees that behave the same way.
	 */
	protected options(): QuadTreeOptions<ItemT> {
		return {
			...this.elements.options(),
			allowDuplicates: this.allowDuplicates,
			allowUndefinedItem: this.allowUndefinedItem
		};
	}

	/**
	 * Call func for each element in pre-order. The non-allocating way to walk
	 * the tree: it reuses internal scratch arrays, so once they have grown to
	 * the tree's size a call allocates nothing.
	 *
	 * @remarks
	 * Like `Map` / `Set`, func receives the tree itself as its third argument,
	 * not an array. Removal relinks a whole subtree, so the walk runs over a
	 * snapshot of the elements taken before func first runs. func may remove
	 * or update any element: removed elements not yet visited are skipped,
	 * and moved ones are still visited once. Elements inserted during the walk
	 * are not visited. func may also start another `forEach()` on this tree.
	 *
	 * @param func		Called with (element, index, tree) in pre-order.
	 * @param thisArg	Value used as `this` when calling func, as passed. Like
	 * 					`Array.prototype.forEach`, `this` is undefined when omitted.
	 */
	public forEach(func: QuadTreeMethod<ItemT, void>, thisArg?: unknown): QuadTree<ItemT> {
		const nodes = this.eachNodes;
		// A forEach started by func stacks its snapshot above this one.
		const start = this.eachTop;
		let end = start;

		for (let node = this._root; node; node = this.nextInPreOrder(node)) {
			nodes[end++] = node;
		}

		this.visitSnapshot(start, end, func, thisArg);

		return this;
	}

	/**
	 * Every item in pre-order. Same as `preOrder()`, since a quadtree has no
	 * sorted order.
	 */
	public values(): ItemT[] {
		return this.preOrder();
	}

	/**
	 * Every item with each node before its quadrants, in quadrant order.
	 */
	public preOrder(): ItemT[] {
		const values: ItemT[] = [];

		for (let node = this._root; node; node = this.nextInPreOrder(node)) {
			values.push(node._value as ItemT);
		}

		return values;
	}

	/**
	 * Every item with each node after its quadrants, in quadrant order.
	 */
	public postOrder(): ItemT[] {
		// Walk node, then quadrants last to first, and reverse the result.
		const values: ItemT[] = [];

		if (this._root) {
			this.pushNode(this._root);
		}

		while (this.stackTop > 0) {
			const node = this.popNode();
			values.push(node._value as ItemT);

			for (let quadrant = 0; quadrant < 4; quadrant++) {
				const child = node._children[quadrant];

				if (child) {
					this.pushNode(child);
				}
			}
		}

		return values.reverse();
	}

	/**
	 * Every item level by level from the root, in quadrant order within a
	 * level.
	 */
	public levelOrder(): ItemT[] {
		const values: ItemT[] = [];
		// The scratch stack serves as the queue: entries are appended at the end
		// and read from the front.
		const queue = this.stackNodes;
		let tail = 0;

		if (this._root) {
			queue[tail++] = this._root;
		}

		for (let head = 0; head < tail; head++) {
			const node = queue[head] as QuadTreeElement<ItemT>;
			queue[head] = null;
			values.push(node._value as ItemT);

			for (let quadrant = 0; quadrant < 4; quadrant++) {
				const child = node._children[quadrant];

				if (child) {
					queue[tail++] = child;
				}
			}
		}

		return values;
	}

	/**
	 * Serialize tree items, in pre-order, to a JSON string.
	 * @returns		JSON string, or null when an item cannot be serialized
	 * 				(e.g. items contain circular references or BigInt values).
	 */
	public stringify(): string | null {
		try {
			return JSON.stringify({type: 'QuadTree', elements: this.values()});
		} catch {
			return null;
		}
	}

	/**
	 * Every node, in pre-order.
	 */
	public toArray(): QuadTreeElement<ItemT>[] {
		const result: QuadTreeElement<ItemT>[] = [];

		for (let node = this._root; node; node = this.nextInPreOrder(node)) {
			result.push(node);
		}

		return result;
	}

	/**
	 * Find elements whose items pass every filter, in pre-order. Each result's
	 * `delete()` removes its element, and does nothing once that element has
	 * been removed some other way. Allocates the result array and one result
	 * per match.
	 */
	public query(
		filters: QueryFilter<ItemT> | QueryFilter<ItemT>[],
		opts?: QueryOptions
	): QueryResult<QuadTreeElement<ItemT>, ItemT>[] {
		const resultsArray: QueryResult<QuadTreeElement<ItemT>, ItemT>[] = [];
		const limit = this.queryLimit(opts);
		let node = this._root;

		// Stops walking as soon as the limit is reached.
		while (node && resultsArray.length < limit) {
			const element = node;
			node = this.nextInPreOrder(element);

			if (!this.queryMatch(filters, element._value as ItemT)) {
				continue;
			}

			const linkId = element._linkId;

			resultsArray.push({
				element: element,
				key: queryNoKey,
				index: queryNoIndex,
				delete: (): ItemT | null => this.queryDelete(element, linkId)
			});
		}

		return resultsArray;
	}

	/**
	 * Unlink and drop every element. Elements removed this way have their
	 * links cleared, and are recycled when pooling is on. Walks the links
	 * directly, releasing leaves bottom up, and allocates nothing.
	 */
	public clearElements(): QuadTree<ItemT> {
		let node = this._root;

		this._root = null;
		this._size = 0;

		while (node) {
			const child = this.firstChild(node, 0);

			if (child) {
				node = child;
				continue;
			}

			// node is a leaf now: cut it from its parent and drop it.
			const parent = node._parent;

			if (parent) {
				parent._children[node._quadrant] = null;
			}

			this.dropNode(node);
			node = parent;
		}

		return this;
	}

	/**
	 * Restore the tree to its freshly constructed state. The locator and
	 * constructor options are kept.
	 */
	public reset(): QuadTree<ItemT> {
		this.clearElements();

		return this;
	}

	/**
	 * Write every node inside bounds, in pre-order, into `into` from index
	 * start on. The one walk behind `withinBounds()` and
	 * `forEachWithinBounds()`. Runs no caller code, so it may use `stackNodes`.
	 * @returns		Index after the last node written; start when nothing
	 * 				matches or bounds is invalid.
	 */
	private collectWithinBounds(
		bounds: QuadTreeBounds,
		into: (QuadTreeElement<ItemT> | null)[],
		start: number
	): number {
		let count = start;

		if (!this._root || !this.isBounds(bounds)) {
			return count;
		}

		const minX = bounds.minX;
		const minY = bounds.minY;
		const maxX = bounds.maxX;
		const maxY = bounds.maxY;

		this.pushNode(this._root);

		while (this.stackTop > 0) {
			const node = this.popNode();

			if (node._x >= minX && node._x <= maxX && node._y >= minY && node._y <= maxY) {
				into[count++] = node;
			}

			// Pushed in reverse so quadrants are visited in order.
			for (let quadrant = 3; quadrant >= 0; quadrant--) {
				const child = node._children[quadrant];

				if (!child) {
					continue;
				}

				// Each ancestor already ruled out its own side, so checking only
				// this node's split is exact.
				const west = (quadrant & 1) !== 0;
				const south = (quadrant & 2) !== 0;
				const xOverlaps = west ? minX < node._x : maxX >= node._x;
				const yOverlaps = south ? minY < node._y : maxY >= node._y;

				if (xOverlaps && yOverlaps) {
					this.pushNode(child);
				}
			}
		}

		return count;
	}

	/**
	 * Write every node within radius of point into `into` from index start
	 * on, the quadrant holding point first. The one walk behind
	 * `withinRadius()` and `forEachWithinRadius()`. Runs no caller code, so it
	 * may use `stackNodes` and `stackRegions`.
	 * @returns		Index after the last node written; start when nothing
	 * 				matches or point or radius is invalid.
	 */
	private collectWithinRadius(
		point: QuadTreePoint,
		radius: number,
		into: (QuadTreeElement<ItemT> | null)[],
		start: number
	): number {
		let count = start;

		if (!this._root || !this.isPoint(point) || !Number.isFinite(radius) || radius < 0) {
			return count;
		}

		const px = point.x;
		const py = point.y;
		const limit = radius * radius;
		const regions = this.stackRegions;

		this.pushRegion(this._root, -Infinity, -Infinity, Infinity, Infinity);

		while (this.stackTop > 0) {
			const top = this.stackTop - 1;
			const base = top * 4;
			const minX = regions[base];
			const minY = regions[base + 1];
			const maxX = regions[base + 2];
			const maxY = regions[base + 3];
			const node = this.popNode();
			const dx = Math.max(minX - px, 0, px - maxX);
			const dy = Math.max(minY - py, 0, py - maxY);

			if (dx * dx + dy * dy > limit) {
				continue;
			}

			if (this.distanceSquared(node, px, py) <= limit) {
				into[count++] = node;
			}

			this.pushChildRegions(node, px, py, minX, minY, maxX, maxY);
		}

		return count;
	}

	/**
	 * Call func for each node in `eachNodes` from start to end that is still
	 * linked to this tree under the id it had when written there. Claims that
	 * range of the snapshot for the call, so func may start another visitor,
	 * which stacks above it, and releases it afterwards even when func throws.
	 */
	private visitSnapshot(
		start: number,
		end: number,
		func: QuadTreeMethod<ItemT, void>,
		thisArg: unknown
	): void {
		const nodes = this.eachNodes;
		const linkIds = this.eachLinkIds;

		for (let i = start; i < end; i++) {
			linkIds[i] = (nodes[i] as QuadTreeElement<ItemT>)._linkId;
		}

		this.eachTop = end;

		try {
			let index = 0;

			for (let i = start; i < end; i++) {
				const node = nodes[i] as QuadTreeElement<ItemT>;

				// A removed node may have been recycled for a later insert, which
				// gives it a new link id.
				if (node._tree !== this || node._linkId !== linkIds[i]) {
					continue;
				}

				func.call(thisArg, node, index, this);
				index++;
			}
		} finally {
			// Drop the references so removed nodes are not kept alive.
			for (let i = start; i < end; i++) {
				nodes[i] = null;
			}

			this.eachTop = start;
		}
	}

	/**
	 * Blank node from the element pool, filled with item at (x, y) and claimed
	 * by this tree under a fresh link id. The caller links it.
	 */
	private createElement(item: ItemT, x: number, y: number): QuadTreeElement<ItemT> {
		const node = this.elements.allocate();
		node._value = item;
		node._x = x;
		node._y = y;
		node._tree = this;
		node._linkId = ++this.lastLinkId;

		return node;
	}

	/**
	 * Descend to the empty slot a new leaf at (x, y) belongs in and store it
	 * in `slotParent` / `slotQuadrant` for `attach()`.
	 * @param unique	When true, stop at a node already at exactly (x, y).
	 * 					Every node at that position lies on the path, since equal
	 * 					coordinates always descend the same way.
	 * @returns			False when unique is true and (x, y) is occupied.
	 */
	private findSlot(x: number, y: number, unique: boolean): boolean {
		let parent: QuadTreeElement<ItemT> | null = null;
		let curr = this._root;
		let quadrant: QuadTreeQuadrant = 0;

		while (curr) {
			if (unique && curr._x === x && curr._y === y) {
				return false;
			}

			parent = curr;
			quadrant = this.quadrantOf(curr, x, y);
			curr = curr._children[quadrant];
		}

		this.slotParent = parent;
		this.slotQuadrant = quadrant;

		return true;
	}

	/**
	 * Hang node, which must have no parent or children, in the slot the last
	 * `findSlot()` found. Does not change the size.
	 */
	private attach(node: QuadTreeElement<ItemT>): void {
		const parent = this.slotParent;

		node._parent = parent;
		node._quadrant = this.slotQuadrant;

		if (parent) {
			parent._children[this.slotQuadrant] = node;
		} else {
			this._root = node;
		}

		this.slotParent = null;
	}

	/**
	 * Hang node, which must have no parent or children, as a new leaf at its
	 * stored position. Does not change the size.
	 */
	private link(node: QuadTreeElement<ItemT>): void {
		this.findSlot(node._x, node._y, false);
		this.attach(node);
	}

	/**
	 * Cut node out of the tree, leaving it with no parent or children, and
	 * relink every node of its subtree from its stored position. A leaf needs
	 * no relinking. Otherwise the subtree is relinked in one pre-order pass
	 * over the scratch stack, which keeps each relinked node's own split ahead
	 * of its former descendants. Does not change the size or node's ownership.
	 */
	private detach(node: QuadTreeElement<ItemT>): void {
		const parent = node._parent;

		if (parent) {
			parent._children[node._quadrant] = null;
		} else {
			this._root = null;
		}

		if (node.isLeaf()) {
			node._parent = null;
			node._quadrant = 0;
			return;
		}

		this.pushChildren(node);
		this.clearLinks(node);

		// The cut subtree is unreachable from the root, and each orphan's links
		// are cleared before it is relinked, so no relink descends into it.
		while (this.stackTop > 0) {
			const orphan = this.popNode();
			this.pushChildren(orphan);
			this.clearLinks(orphan);
			this.link(orphan);
		}
	}

	/** Push node's children last quadrant first, so they pop in quadrant order. */
	private pushChildren(node: QuadTreeElement<ItemT>): void {
		for (let quadrant = 3; quadrant >= 0; quadrant--) {
			const child = node._children[quadrant];

			if (child) {
				this.pushNode(child);
			}
		}
	}

	private pushNode(node: QuadTreeElement<ItemT>): void {
		this.stackNodes[this.stackTop++] = node;
	}

	/** Pop the top node, clearing its slot so it is not kept alive. */
	private popNode(): QuadTreeElement<ItemT> {
		const top = --this.stackTop;
		const node = this.stackNodes[top] as QuadTreeElement<ItemT>;
		this.stackNodes[top] = null;

		return node;
	}

	/** Push node with the region of the plane its subtree covers. */
	private pushRegion(
		node: QuadTreeElement<ItemT>,
		minX: number,
		minY: number,
		maxX: number,
		maxY: number
	): void {
		// Slots fill in order, so each write lands inside or right at the end
		// of the array and never leaves a hole.
		const base = this.stackTop * 4;
		const regions = this.stackRegions;

		regions[base] = minX;
		regions[base + 1] = minY;
		regions[base + 2] = maxX;
		regions[base + 3] = maxY;
		this.pushNode(node);
	}

	/**
	 * Push node's children with the part of node's region each covers. The
	 * quadrant holding (px, py) is pushed last, so it is searched first and
	 * near matches are found early.
	 */
	private pushChildRegions(
		node: QuadTreeElement<ItemT>,
		px: number,
		py: number,
		minX: number,
		minY: number,
		maxX: number,
		maxY: number
	): void {
		const home = this.quadrantOf(node, px, py);

		for (let quadrant = 3; quadrant >= 0; quadrant--) {
			if (quadrant !== home) {
				this.pushChildRegion(node, quadrant, minX, minY, maxX, maxY);
			}
		}

		this.pushChildRegion(node, home, minX, minY, maxX, maxY);
	}

	/**
	 * Push node's child in quadrant, with the part of node's region that
	 * quadrant covers. No-op when that quadrant is empty.
	 */
	private pushChildRegion(
		node: QuadTreeElement<ItemT>,
		quadrant: number,
		minX: number,
		minY: number,
		maxX: number,
		maxY: number
	): void {
		const child = node._children[quadrant];

		if (!child) {
			return;
		}

		const west = (quadrant & 1) !== 0;
		const south = (quadrant & 2) !== 0;

		this.pushRegion(
			child,
			west ? minX : node._x,
			south ? minY : node._y,
			west ? node._x : maxX,
			south ? node._y : maxY
		);
	}

	/**
	 * Quadrant of node that position (x, y) falls in. A coordinate equal to
	 * node's falls on the east or north side.
	 */
	private quadrantOf(node: QuadTreeElement<ItemT>, x: number, y: number): QuadTreeQuadrant {
		return ((x < node._x ? 1 : 0) | (y < node._y ? 2 : 0)) as QuadTreeQuadrant;
	}

	/**
	 * First node at exactly (x, y) on its search path. Every node at that
	 * position lies on the path, since equal coordinates always descend the
	 * same way.
	 */
	private findAt(x: number, y: number): QuadTreeElement<ItemT> | null {
		let curr = this._root;

		while (curr) {
			if (curr._x === x && curr._y === y) {
				return curr;
			}

			curr = curr._children[this.quadrantOf(curr, x, y)];
		}

		return null;
	}

	private distanceSquared(node: QuadTreeElement<ItemT>, x: number, y: number): number {
		const dx = node._x - x;
		const dy = node._y - y;

		return dx * dx + dy * dy;
	}

	private isPoint(point: unknown): point is QuadTreePoint {
		if (typeof point !== 'object' || point === null) {
			return false;
		}

		const candidate = point as Partial<QuadTreePoint>;

		return Number.isFinite(candidate.x) && Number.isFinite(candidate.y);
	}

	private isBounds(bounds: unknown): bounds is QuadTreeBounds {
		if (typeof bounds !== 'object' || bounds === null) {
			return false;
		}

		const {minX, minY, maxX, maxY} = bounds as Partial<QuadTreeBounds>;

		return (
			Number.isFinite(minX) &&
			Number.isFinite(minY) &&
			Number.isFinite(maxX) &&
			Number.isFinite(maxY) &&
			(minX as number) <= (maxX as number) &&
			(minY as number) <= (maxY as number)
		);
	}

	/** node's first child in quadrant from or later, or null when there is none. */
	private firstChild(node: QuadTreeElement<ItemT>, from: number): QuadTreeElement<ItemT> | null {
		for (let quadrant = from; quadrant < 4; quadrant++) {
			const child = node._children[quadrant];

			if (child) {
				return child;
			}
		}

		return null;
	}

	/**
	 * Node after node in pre-order: its first child, or else the next
	 * non-empty quadrant of the nearest ancestor that has one.
	 */
	private nextInPreOrder(node: QuadTreeElement<ItemT>): QuadTreeElement<ItemT> | null {
		const child = this.firstChild(node, 0);

		if (child) {
			return child;
		}

		let curr = node;

		while (curr._parent) {
			const sibling = this.firstChild(curr._parent, curr._quadrant + 1);

			if (sibling) {
				return sibling;
			}

			curr = curr._parent;
		}

		return null;
	}

	/** Clear node's parent and child links, keeping its item and ownership. */
	private clearLinks(node: QuadTreeElement<ItemT>): void {
		node._parent = null;
		node._children[0] = null;
		node._children[1] = null;
		node._children[2] = null;
		node._children[3] = null;
		node._quadrant = 0;
	}

	/**
	 * Clear node's links, position, and ownership. Needed when pooling is off,
	 * where release does not blank the node.
	 */
	private unlink(node: QuadTreeElement<ItemT>): void {
		this.clearLinks(node);
		node._x = 0;
		node._y = 0;
		node._tree = null;
		node._linkId = 0;
	}

	/**
	 * Hand a node that is already out of the tree back to the element pool.
	 * With pooling on, release blanks every field, so it is not cleared twice.
	 */
	private dropNode(node: QuadTreeElement<ItemT>): void {
		if (this.elements.enabled()) {
			this.elements.release(node);
		} else {
			this.unlink(node);
		}
	}

	private isPartOfTree(node: QuadTreeElement<ItemT>): boolean {
		return node._tree === this;
	}

	/** Whether value passes filters: every one of them, and at least one. */
	private queryMatch(filters: QueryFilter<ItemT> | QueryFilter<ItemT>[], value: ItemT): boolean {
		if (!Array.isArray(filters)) {
			return filters(value);
		}

		if (filters.length === 0) {
			return false;
		}

		for (let i = 0; i < filters.length; i++) {
			const filter = filters[i];

			if (!filter(value)) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Remove a query match, but only while element still holds the item it
	 * matched. A recycled element reissued to a later insert carries a new
	 * link id, so a stale result deletes nothing instead of the new item.
	 */
	private queryDelete(element: QuadTreeElement<ItemT>, linkId: number): ItemT | null {
		if (element._linkId !== linkId) {
			return null;
		}

		return this.removeNode(element);
	}

	/** Result cap from opts: a rounded number of at least 1, or Infinity. */
	private queryLimit(opts?: QueryOptions): number {
		const limit = opts?.limit;

		if (limit && isNumber(limit) && limit >= 1) {
			return Math.round(limit);
		}

		return Infinity;
	}
}
