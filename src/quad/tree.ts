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
import {isNumber} from '../utility';

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
 * @remarks
 * The tree is not self-balancing: its shape depends on insertion order, so
 * depth ranges from O(log n) for well spread input to O(n) for input sorted
 * along both axes. Removing a node relinks every node in its subtree, which
 * is the conventional point quadtree deletion. It costs O(k * depth) for a
 * subtree of k nodes, and removing the root relinks the whole tree.
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
	private _root: QuadTreeElement<ItemT> | null;
	private _size: number;
	/** Last id handed to a linked node. Only increases, so ids never repeat. */
	private lastLinkId: number;
	/** Source of node wrappers, pooled or freshly allocated per options. */
	private readonly elements: ElementPool<QuadTreeElement<ItemT>>;

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
		this._root = null;
		this._size = 0;
		this.lastLinkId = 0;
		// The element class is generic and the pool builds blank nodes with no
		// value, so any ItemT instantiation is valid here.
		this.elements = new ElementPool(
			QuadTreeElement as ObjectPoolConstructor<QuadTreeElement<ItemT>>,
			options
		);

		if (Array.isArray(data)) {
			this.insertArray(data);
		}
	}

	/**
	 * Iterate items in pre-order, each node before its quadrants.
	 */
	[Symbol.iterator](): QuadTreeIterator<ItemT> {
		return new QuadTreeIterator<ItemT>(this);
	}

	/**
	 * Insert item at the position its locator returns, as a new leaf, in
	 * O(depth).
	 * @returns		The node now holding item. `invalid_position` when the
	 * 				locator does not return finite x and y coordinates, or
	 * 				`duplicate_not_allowed` when an item already sits at that
	 * 				exact position and duplicates are not allowed. Nothing is
	 * 				added in either case.
	 */
	public insert(item: ItemT): QuadTreeElement<ItemT> | QuadTreeError {
		const point = this.locator(item);

		if (!this.isPoint(point)) {
			return 'invalid_position';
		}

		if (!this.allowDuplicates && this.findAt(point.x, point.y)) {
			return 'duplicate_not_allowed';
		}

		// Allocated only once the item is known to be accepted.
		const node = this.createElement(item, point.x, point.y);
		this.link(node);
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

		for (const item of items) {
			this.insert(item);
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

		let curr = this._root;

		while (curr) {
			if (curr._value === item) {
				return this.removeNode(curr);
			}

			curr = curr._children[this.quadrantOf(curr, point.x, point.y)];
		}

		return null;
	}

	/**
	 * Unlink node from the tree and return its value. Every node in node's
	 * subtree is relinked from its position, in O(k * depth) for a subtree of
	 * k nodes. Those nodes keep their items. With pooling on, the removed node
	 * is recycled and must not be used afterwards.
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
		this.unlink(node);
		this.elements.release(node);

		return value;
	}

	/**
	 * Set node's item and move node to the item's position. For an item
	 * changed in place, pass the node's own item: `tree.update(node,
	 * node.value())`. When the position is unchanged, nothing moves. Otherwise
	 * node is unlinked as in `removeNode()` and relinked at the new position.
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

		if (point.x === node._x && point.y === node._y) {
			return node;
		}

		// node still sits at its old position, so any match here is another node.
		if (!this.allowDuplicates && this.findAt(point.x, point.y)) {
			this.removeNode(node);
			return 'duplicate_not_allowed';
		}

		this.detach(node);
		node._x = point.x;
		node._y = point.y;
		this.link(node);

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
	 * Quadrants lying wholly outside bounds are skipped.
	 * @returns		Matching nodes, or an empty array when bounds has a
	 * 				non-finite value or a min greater than its max.
	 */
	public withinBounds(bounds: QuadTreeBounds): QuadTreeElement<ItemT>[] {
		const result: QuadTreeElement<ItemT>[] = [];

		if (!this.isBounds(bounds)) {
			return result;
		}

		const {minX, minY, maxX, maxY} = bounds;
		const stack: QuadTreeElement<ItemT>[] = this._root ? [this._root] : [];

		while (stack.length > 0) {
			const node = stack.pop() as QuadTreeElement<ItemT>;

			if (node._x >= minX && node._x <= maxX && node._y >= minY && node._y <= maxY) {
				result.push(node);
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
					stack.push(child);
				}
			}
		}

		return result;
	}

	/**
	 * Nodes whose positions lie within radius of point, boundary included, in
	 * pre-order. Quadrants lying wholly beyond radius are skipped.
	 * @returns		Matching nodes, or an empty array when point does not have
	 * 				finite x and y coordinates or radius is not a finite number
	 * 				of at least 0.
	 */
	public withinRadius(point: QuadTreePoint, radius: number): QuadTreeElement<ItemT>[] {
		const result: QuadTreeElement<ItemT>[] = [];

		if (!this.isPoint(point) || !Number.isFinite(radius) || radius < 0) {
			return result;
		}

		const limit = radius * radius;

		this.walkRegions(point, (node, regionDistance) => {
			if (regionDistance > limit) {
				return false;
			}

			if (this.distanceSquared(node, point) <= limit) {
				result.push(node);
			}

			return true;
		});

		return result;
	}

	/**
	 * Node whose position is nearest to point by straight-line distance.
	 * Quadrants that cannot hold anything nearer than the best match so far
	 * are skipped. When several nodes are equally near, returns one of them.
	 * @returns		Nearest node, or null when the tree is empty or point does
	 * 				not have finite x and y coordinates.
	 */
	public nearest(point: QuadTreePoint): QuadTreeElement<ItemT> | null {
		if (!this.isPoint(point)) {
			return null;
		}

		let best: QuadTreeElement<ItemT> | null = null;
		let bestDistance = Infinity;

		this.walkRegions(point, (node, regionDistance) => {
			if (regionDistance >= bestDistance) {
				return false;
			}

			const distance = this.distanceSquared(node, point);

			if (distance < bestDistance) {
				best = node;
				bestDistance = distance;
			}

			return true;
		});

		// Assigned inside the callback, which control flow analysis cannot see.
		return best as QuadTreeElement<ItemT> | null;
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
	 * Number of edges on the longest root to leaf path, found with a level
	 * order walk in O(n).
	 * @returns		Height, 0 for a lone root, or -1 when the tree is empty.
	 */
	public height(): number {
		let level: QuadTreeElement<ItemT>[] = this._root ? [this._root] : [];
		let height = -1;

		while (level.length > 0) {
			const next: QuadTreeElement<ItemT>[] = [];

			for (const node of level) {
				for (const child of node._children) {
					if (child) {
						next.push(child);
					}
				}
			}

			level = next;
			height++;
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
		return {...this.elements.options(), allowDuplicates: this.allowDuplicates};
	}

	/**
	 * Call func for each element in pre-order.
	 *
	 * @remarks
	 * Like `Map` / `Set`, func receives the tree itself as its third argument,
	 * not an array. Removal relinks a whole subtree, so the walk runs over a
	 * snapshot of the elements taken before func first runs. func may remove
	 * or update any element: removed elements not yet visited are skipped,
	 * and moved ones are still visited once. Elements inserted during the walk
	 * are not visited.
	 *
	 * @param func		Called with (element, index, tree) in pre-order.
	 * @param thisArg	Value used as `this` when calling func, as passed. Like
	 * 					`Array.prototype.forEach`, `this` is undefined when omitted.
	 */
	public forEach(func: QuadTreeMethod<ItemT, void>, thisArg?: unknown): QuadTree<ItemT> {
		const nodes = this.toArray();
		const linkIds = nodes.map((node) => node._linkId);
		let index = 0;

		for (let i = 0; i < nodes.length; i++) {
			const node = nodes[i];

			// A removed node may have been recycled for a later insert, which
			// gives it a new link id.
			if (node._tree !== this || node._linkId !== linkIds[i]) {
				continue;
			}

			func.call(thisArg, node, index, this);
			index++;
		}

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
		return this.toArray().map((node) => node._value as ItemT);
	}

	/**
	 * Every item with each node after its quadrants, in quadrant order.
	 */
	public postOrder(): ItemT[] {
		// Walk node, then quadrants last to first, and reverse the result.
		const values: ItemT[] = [];
		const stack: QuadTreeElement<ItemT>[] = this._root ? [this._root] : [];

		while (stack.length > 0) {
			const node = stack.pop() as QuadTreeElement<ItemT>;
			values.push(node._value as ItemT);

			for (const child of node._children) {
				if (child) {
					stack.push(child);
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
		const queue: QuadTreeElement<ItemT>[] = this._root ? [this._root] : [];

		for (let i = 0; i < queue.length; i++) {
			const node = queue[i];
			values.push(node._value as ItemT);

			for (const child of node._children) {
				if (child) {
					queue.push(child);
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
		let node = this._root;

		while (node) {
			result.push(node);
			node = this.nextInPreOrder(node);
		}

		return result;
	}

	/**
	 * Find elements whose items pass every filter, in pre-order. Each result's
	 * `delete()` removes its element, and does nothing once that element has
	 * been removed some other way.
	 */
	public query(
		filters: QueryFilter<ItemT> | QueryFilter<ItemT>[],
		opts?: QueryOptions
	): QueryResult<QuadTreeElement<ItemT>, ItemT>[] {
		const resultsArray: QueryResult<QuadTreeElement<ItemT>, ItemT>[] = [];
		const options = this.queryOptions(opts);
		let node = this._root;

		// Stops walking as soon as the limit is reached.
		while (node && resultsArray.length < options.limit) {
			const element = node;
			const value = element._value as ItemT;
			node = this.nextInPreOrder(element);

			const take = Array.isArray(filters)
				? filters.length > 0 && filters.every((filter) => filter(value))
				: filters(value);

			if (!take) {
				continue;
			}

			resultsArray.push({
				element: element,
				key: (): string | null => null,
				index: (): number | null => null,
				delete: this.queryDelete.bind(this, element, element._linkId)
			});
		}

		return resultsArray;
	}

	/**
	 * Unlink and drop every element. Elements removed this way have their
	 * links cleared, and are recycled when pooling is on.
	 */
	public clearElements(): QuadTree<ItemT> {
		const nodes = this.toArray();

		for (const node of nodes) {
			this.unlink(node);
		}

		this._root = null;
		this._size = 0;
		this.elements.releaseAll(nodes);

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
	 * Hang node, which must have no parent or children, as a new leaf at its
	 * stored position. Does not change the size.
	 */
	private link(node: QuadTreeElement<ItemT>): void {
		let parent: QuadTreeElement<ItemT> | null = null;
		let curr = this._root;
		let quadrant: QuadTreeQuadrant = 0;

		while (curr) {
			parent = curr;
			quadrant = this.quadrantOf(curr, node._x, node._y);
			curr = curr._children[quadrant];
		}

		node._parent = parent;
		node._quadrant = quadrant;

		if (parent) {
			parent._children[quadrant] = node;
		} else {
			this._root = node;
		}
	}

	/**
	 * Cut node out of the tree, leaving it with no parent or children, and
	 * relink every node of its subtree from its stored position. Relinking in
	 * pre-order keeps each relinked node's own split ahead of its former
	 * descendants. Does not change the size or node's ownership.
	 */
	private detach(node: QuadTreeElement<ItemT>): void {
		const orphans = this.subtree(node);
		// The first entry is node itself.
		orphans.shift();

		const parent = node._parent;

		if (parent) {
			parent._children[node._quadrant] = null;
		} else {
			this._root = null;
		}

		this.clearLinks(node);

		for (const orphan of orphans) {
			this.clearLinks(orphan);
		}

		for (const orphan of orphans) {
			this.link(orphan);
		}
	}

	/**
	 * Every node in node's subtree, node first, in pre-order.
	 */
	private subtree(node: QuadTreeElement<ItemT>): QuadTreeElement<ItemT>[] {
		const result: QuadTreeElement<ItemT>[] = [];
		const stack: QuadTreeElement<ItemT>[] = [node];

		while (stack.length > 0) {
			const curr = stack.pop() as QuadTreeElement<ItemT>;
			result.push(curr);

			for (let quadrant = 3; quadrant >= 0; quadrant--) {
				const child = curr._children[quadrant];

				if (child) {
					stack.push(child);
				}
			}
		}

		return result;
	}

	/**
	 * Depth first walk that tracks the region of the plane each node's
	 * subtree covers. visit receives each node with the squared distance from
	 * point to its region, and returns false to skip that node and its
	 * subtree. The quadrant holding point is visited first, so near matches
	 * are found early.
	 */
	private walkRegions(
		point: QuadTreePoint,
		visit: (node: QuadTreeElement<ItemT>, regionDistance: number) => boolean
	): void {
		if (!this._root) {
			return;
		}

		const nodes: QuadTreeElement<ItemT>[] = [this._root];
		// Four entries per node: minX, minY, maxX, maxY of its region.
		const regions: number[] = [-Infinity, -Infinity, Infinity, Infinity];

		while (nodes.length > 0) {
			const node = nodes.pop() as QuadTreeElement<ItemT>;
			const maxY = regions.pop() as number;
			const maxX = regions.pop() as number;
			const minY = regions.pop() as number;
			const minX = regions.pop() as number;

			const dx = Math.max(minX - point.x, 0, point.x - maxX);
			const dy = Math.max(minY - point.y, 0, point.y - maxY);

			if (!visit(node, dx * dx + dy * dy)) {
				continue;
			}

			// Pushed last, so popped first.
			const home = this.quadrantOf(node, point.x, point.y);

			for (let quadrant = 3; quadrant >= 0; quadrant--) {
				if (quadrant !== home) {
					this.pushRegion(nodes, regions, node, quadrant, minX, minY, maxX, maxY);
				}
			}

			this.pushRegion(nodes, regions, node, home, minX, minY, maxX, maxY);
		}
	}

	/**
	 * Push node's child in quadrant, with the part of node's region that
	 * quadrant covers. No-op when that quadrant is empty.
	 */
	private pushRegion(
		nodes: QuadTreeElement<ItemT>[],
		regions: number[],
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

		nodes.push(child);
		regions.push(
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

	private distanceSquared(node: QuadTreeElement<ItemT>, point: QuadTreePoint): number {
		const dx = node._x - point.x;
		const dy = node._y - point.y;

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

	/**
	 * Node after node in pre-order: its first child, or else the next
	 * non-empty quadrant of the nearest ancestor that has one.
	 */
	private nextInPreOrder(node: QuadTreeElement<ItemT>): QuadTreeElement<ItemT> | null {
		for (const child of node._children) {
			if (child) {
				return child;
			}
		}

		let curr = node;

		while (curr._parent) {
			const parent = curr._parent;

			for (let quadrant = curr._quadrant + 1; quadrant < 4; quadrant++) {
				const sibling = parent._children[quadrant];

				if (sibling) {
					return sibling;
				}
			}

			curr = parent;
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
	 * Clear node's links, position, and ownership. Needed even when pooling is
	 * off, where release does not blank the node.
	 */
	private unlink(node: QuadTreeElement<ItemT>): void {
		this.clearLinks(node);
		node._x = 0;
		node._y = 0;
		node._tree = null;
		node._linkId = 0;
	}

	private isPartOfTree(node: QuadTreeElement<ItemT>): boolean {
		return node._tree === this;
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

	private queryOptions(opts?: QueryOptions): Required<QueryOptions> {
		const options: Required<QueryOptions> = {
			limit: Infinity
		};

		if (opts?.limit && isNumber(opts.limit) && opts.limit >= 1) {
			options.limit = Math.round(opts.limit);
		}

		return options;
	}
}
