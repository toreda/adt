import type {OctTreeBounds} from './tree/bounds';
import {OctTreeElement} from './tree/element';
import type {OctTreeError} from './tree/error';
import {OctTreeIterator} from './tree/iterator';
import type {OctTreeLocator} from './tree/locator';
import type {OctTreeMethod} from './tree/method';
import type {OctTreeOptions} from './tree/options';
import type {OctTreePoint} from './tree/point';
import type {OctTreeOctant} from './tree/octant';
import {ElementPool} from '../element/pool';
import type {ObjectPoolConstructor} from '../object/pool/constructor';
import type {QueryFilter} from '../query/filter';
import type {QueryOptions} from '../query/options';
import type {QueryResult} from '../query/result';
import type {Tree} from '../tree';
import {booleanValue} from '../boolean/value';
import {isNumber} from '../utility';

/**
 * Point octree: each node holds one item at a position in 3D space, read by a
 * caller supplied locator, and splits space around that position into eight
 * octants (see `OctTreeOctant`). Each octant holds a subtree of the items
 * lying in it. Space is unbounded: any finite position fits.
 *
 * Insert and exact position search take O(depth). Range, radius, and nearest
 * neighbor searches skip every octant that cannot hold a match. Every walk
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
 * along every axis. Removing a node relinks every node in its subtree, which
 * is the conventional point octree deletion. It costs O(k * depth) for a
 * subtree of k nodes, and removing the root relinks the whole tree.
 *
 * Duplicates are allowed by default: an item at exactly the position of
 * existing ones is placed in their octant 0, below them. With
 * `allowDuplicates: false`, adding a duplicate adds nothing and returns an
 * error code instead of throwing.
 *
 * Each node stores the position its item was filed under, so the tree cannot
 * see an item move after it was inserted. After changing anything the
 * locator reads, call `update()` so the node is moved to the new position.
 *
 * @category Oct Tree
 */
export class OctTree<ItemT> implements Tree<ItemT, OctTreeElement<ItemT>> {
	/** Reads item positions. Required at construction, fixed for the tree's lifetime. */
	public readonly locator: OctTreeLocator<ItemT>;
	/** Whether items at exactly the position of one already in the tree are accepted. */
	public readonly allowDuplicates: boolean;
	private _root: OctTreeElement<ItemT> | null;
	private _size: number;
	/** Last id handed to a linked node. Only increases, so ids never repeat. */
	private lastLinkId: number;
	/** Source of node wrappers, pooled or freshly allocated per options. */
	private readonly elements: ElementPool<OctTreeElement<ItemT>>;

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
		locator: OctTreeLocator<ItemT>,
		data?: ItemT[] | null,
		options?: OctTreeOptions<ItemT> | null
	) {
		if (typeof locator !== 'function') {
			throw new Error('OctTree requires a locator function');
		}

		this.locator = locator;
		this.allowDuplicates = booleanValue(true, options?.allowDuplicates);
		this._root = null;
		this._size = 0;
		this.lastLinkId = 0;
		// The element class is generic and the pool builds blank nodes with no
		// value, so any ItemT instantiation is valid here.
		this.elements = new ElementPool(
			OctTreeElement as ObjectPoolConstructor<OctTreeElement<ItemT>>,
			options
		);

		if (Array.isArray(data)) {
			this.insertArray(data);
		}
	}

	/**
	 * Iterate items in pre-order, each node before its octants.
	 */
	[Symbol.iterator](): OctTreeIterator<ItemT> {
		return new OctTreeIterator<ItemT>(this);
	}

	/**
	 * Insert item at the position its locator returns, as a new leaf, in
	 * O(depth).
	 * @returns		The node now holding item. `invalid_position` when the
	 * 				locator does not return finite x, y, and z coordinates, or
	 * 				`duplicate_not_allowed` when an item already sits at that
	 * 				exact position and duplicates are not allowed. Nothing is
	 * 				added in either case.
	 */
	public insert(item: ItemT): OctTreeElement<ItemT> | OctTreeError {
		const point = this.locator(item);

		if (!this.isPoint(point)) {
			return 'invalid_position';
		}

		if (!this.allowDuplicates && this.findAt(point.x, point.y, point.z)) {
			return 'duplicate_not_allowed';
		}

		// Allocated only once the item is known to be accepted.
		const node = this.createElement(item, point.x, point.y, point.z);
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
	 * 				does not have finite x, y, and z coordinates.
	 */
	public find(point: OctTreePoint): OctTreeElement<ItemT> | null {
		if (!this.isPoint(point)) {
			return null;
		}

		return this.findAt(point.x, point.y, point.z);
	}

	/**
	 * Check whether any item sits at exactly point.
	 */
	public contains(point: OctTreePoint): boolean {
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

			curr = curr._children[this.octantOf(curr, point.x, point.y, point.z)];
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
	public removeNode(node: OctTreeElement<ItemT> | null): ItemT | null {
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
	 * 				locator does not return finite x, y, and z coordinates for item,
	 * 				or `duplicate_not_allowed` when another item sits at the new
	 * 				position and duplicates are not allowed: node is removed in
	 * 				both cases and item is no longer in the tree. Null when node
	 * 				is null or not part of this tree; nothing changes then.
	 */
	public update(
		node: OctTreeElement<ItemT> | null,
		item: ItemT
	): OctTreeElement<ItemT> | OctTreeError | null {
		if (!node || !this.isPartOfTree(node)) {
			return null;
		}

		const point = this.locator(item);

		if (!this.isPoint(point)) {
			this.removeNode(node);
			return 'invalid_position';
		}

		node._value = item;

		if (point.x === node._x && point.y === node._y && point.z === node._z) {
			return node;
		}

		// node still sits at its old position, so any match here is another node.
		if (!this.allowDuplicates && this.findAt(point.x, point.y, point.z)) {
			this.removeNode(node);
			return 'duplicate_not_allowed';
		}

		this.detach(node);
		node._x = point.x;
		node._y = point.y;
		node._z = point.z;
		this.link(node);

		return node;
	}

	/**
	 * Get the topmost node if one exists.
	 * @returns		Root node, or null when the tree is empty.
	 */
	public root(): OctTreeElement<ItemT> | null {
		return this._root;
	}

	/**
	 * Nodes whose positions lie inside bounds, faces included, in pre-order.
	 * Octants lying wholly outside bounds are skipped.
	 * @returns		Matching nodes, or an empty array when bounds has a
	 * 				non-finite value or a min greater than its max.
	 */
	public withinBounds(bounds: OctTreeBounds): OctTreeElement<ItemT>[] {
		const result: OctTreeElement<ItemT>[] = [];

		if (!this.isBounds(bounds)) {
			return result;
		}

		const {minX, minY, minZ, maxX, maxY, maxZ} = bounds;
		const stack: OctTreeElement<ItemT>[] = this._root ? [this._root] : [];

		while (stack.length > 0) {
			const node = stack.pop() as OctTreeElement<ItemT>;

			if (
				node._x >= minX &&
				node._x <= maxX &&
				node._y >= minY &&
				node._y <= maxY &&
				node._z >= minZ &&
				node._z <= maxZ
			) {
				result.push(node);
			}

			// Pushed in reverse so octants are visited in order.
			for (let octant = 7; octant >= 0; octant--) {
				const child = node._children[octant];

				if (!child) {
					continue;
				}

				// Each ancestor already ruled out its own side, so checking only
				// this node's split is exact.
				const lowX = (octant & 1) !== 0;
				const lowY = (octant & 2) !== 0;
				const lowZ = (octant & 4) !== 0;
				const xOverlaps = lowX ? minX < node._x : maxX >= node._x;
				const yOverlaps = lowY ? minY < node._y : maxY >= node._y;
				const zOverlaps = lowZ ? minZ < node._z : maxZ >= node._z;

				if (xOverlaps && yOverlaps && zOverlaps) {
					stack.push(child);
				}
			}
		}

		return result;
	}

	/**
	 * Nodes whose positions lie within radius of point, boundary included, in
	 * pre-order. Octants lying wholly beyond radius are skipped.
	 * @returns		Matching nodes, or an empty array when point does not have
	 * 				finite x, y, and z coordinates or radius is not a finite number
	 * 				of at least 0.
	 */
	public withinRadius(point: OctTreePoint, radius: number): OctTreeElement<ItemT>[] {
		const result: OctTreeElement<ItemT>[] = [];

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
	 * Octants that cannot hold anything nearer than the best match so far
	 * are skipped. When several nodes are equally near, returns one of them.
	 * @returns		Nearest node, or null when the tree is empty or point does
	 * 				not have finite x, y, and z coordinates.
	 */
	public nearest(point: OctTreePoint): OctTreeElement<ItemT> | null {
		if (!this.isPoint(point)) {
			return null;
		}

		let best: OctTreeElement<ItemT> | null = null;
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
		return best as OctTreeElement<ItemT> | null;
	}

	/**
	 * Node after node in pre-order, found by following links in O(depth).
	 * @returns		Next node, or null when node is the last, is null, or is not
	 * 				part of this tree.
	 */
	public preOrderNext(node: OctTreeElement<ItemT> | null): OctTreeElement<ItemT> | null {
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
		let level: OctTreeElement<ItemT>[] = this._root ? [this._root] : [];
		let height = -1;

		while (level.length > 0) {
			const next: OctTreeElement<ItemT>[] = [];

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
	public depth(node: OctTreeElement<ItemT> | null): number | null {
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
	public filter(func: OctTreeMethod<ItemT, boolean>, thisArg?: unknown): OctTree<ItemT> {
		const tree = new OctTree<ItemT>(this.locator, null, this.options());
		tree.insertArray(this.filterValues(func, thisArg));

		return tree;
	}

	/**
	 * Items of elements for which func returns true, in pre-order. Subclasses
	 * build their own `filter()` result from this.
	 */
	protected filterValues(func: OctTreeMethod<ItemT, boolean>, thisArg?: unknown): ItemT[] {
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
	protected options(): OctTreeOptions<ItemT> {
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
	public forEach(func: OctTreeMethod<ItemT, void>, thisArg?: unknown): OctTree<ItemT> {
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
	 * Every item in pre-order. Same as `preOrder()`, since an octree has no
	 * sorted order.
	 */
	public values(): ItemT[] {
		return this.preOrder();
	}

	/**
	 * Every item with each node before its octants, in octant order.
	 */
	public preOrder(): ItemT[] {
		return this.toArray().map((node) => node._value as ItemT);
	}

	/**
	 * Every item with each node after its octants, in octant order.
	 */
	public postOrder(): ItemT[] {
		// Walk node, then octants last to first, and reverse the result.
		const values: ItemT[] = [];
		const stack: OctTreeElement<ItemT>[] = this._root ? [this._root] : [];

		while (stack.length > 0) {
			const node = stack.pop() as OctTreeElement<ItemT>;
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
	 * Every item level by level from the root, in octant order within a
	 * level.
	 */
	public levelOrder(): ItemT[] {
		const values: ItemT[] = [];
		const queue: OctTreeElement<ItemT>[] = this._root ? [this._root] : [];

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
			return JSON.stringify({type: 'OctTree', elements: this.values()});
		} catch {
			return null;
		}
	}

	/**
	 * Every node, in pre-order.
	 */
	public toArray(): OctTreeElement<ItemT>[] {
		const result: OctTreeElement<ItemT>[] = [];
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
	): QueryResult<OctTreeElement<ItemT>, ItemT>[] {
		const resultsArray: QueryResult<OctTreeElement<ItemT>, ItemT>[] = [];
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
	public clearElements(): OctTree<ItemT> {
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
	public reset(): OctTree<ItemT> {
		this.clearElements();

		return this;
	}

	/**
	 * Blank node from the element pool, filled with item at (x, y, z) and
	 * claimed by this tree under a fresh link id. The caller links it.
	 */
	private createElement(item: ItemT, x: number, y: number, z: number): OctTreeElement<ItemT> {
		const node = this.elements.allocate();
		node._value = item;
		node._x = x;
		node._y = y;
		node._z = z;
		node._tree = this;
		node._linkId = ++this.lastLinkId;

		return node;
	}

	/**
	 * Hang node, which must have no parent or children, as a new leaf at its
	 * stored position. Does not change the size.
	 */
	private link(node: OctTreeElement<ItemT>): void {
		let parent: OctTreeElement<ItemT> | null = null;
		let curr = this._root;
		let octant: OctTreeOctant = 0;

		while (curr) {
			parent = curr;
			octant = this.octantOf(curr, node._x, node._y, node._z);
			curr = curr._children[octant];
		}

		node._parent = parent;
		node._octant = octant;

		if (parent) {
			parent._children[octant] = node;
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
	private detach(node: OctTreeElement<ItemT>): void {
		const orphans = this.subtree(node);
		// The first entry is node itself.
		orphans.shift();

		const parent = node._parent;

		if (parent) {
			parent._children[node._octant] = null;
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
	private subtree(node: OctTreeElement<ItemT>): OctTreeElement<ItemT>[] {
		const result: OctTreeElement<ItemT>[] = [];
		const stack: OctTreeElement<ItemT>[] = [node];

		while (stack.length > 0) {
			const curr = stack.pop() as OctTreeElement<ItemT>;
			result.push(curr);

			for (let octant = 7; octant >= 0; octant--) {
				const child = curr._children[octant];

				if (child) {
					stack.push(child);
				}
			}
		}

		return result;
	}

	/**
	 * Depth first walk that tracks the region of space each node's
	 * subtree covers. visit receives each node with the squared distance from
	 * point to its region, and returns false to skip that node and its
	 * subtree. The octant holding point is visited first, so near matches
	 * are found early.
	 */
	private walkRegions(
		point: OctTreePoint,
		visit: (node: OctTreeElement<ItemT>, regionDistance: number) => boolean
	): void {
		if (!this._root) {
			return;
		}

		const nodes: OctTreeElement<ItemT>[] = [this._root];
		// Six entries per node: minX, minY, minZ, maxX, maxY, maxZ of its region.
		const regions: number[] = [-Infinity, -Infinity, -Infinity, Infinity, Infinity, Infinity];

		while (nodes.length > 0) {
			const node = nodes.pop() as OctTreeElement<ItemT>;
			const maxZ = regions.pop() as number;
			const maxY = regions.pop() as number;
			const maxX = regions.pop() as number;
			const minZ = regions.pop() as number;
			const minY = regions.pop() as number;
			const minX = regions.pop() as number;

			const dx = Math.max(minX - point.x, 0, point.x - maxX);
			const dy = Math.max(minY - point.y, 0, point.y - maxY);
			const dz = Math.max(minZ - point.z, 0, point.z - maxZ);

			if (!visit(node, dx * dx + dy * dy + dz * dz)) {
				continue;
			}

			// Pushed last, so popped first.
			const home = this.octantOf(node, point.x, point.y, point.z);

			for (let octant = 7; octant >= 0; octant--) {
				if (octant !== home) {
					this.pushRegion(nodes, regions, node, octant, minX, minY, minZ, maxX, maxY, maxZ);
				}
			}

			this.pushRegion(nodes, regions, node, home, minX, minY, minZ, maxX, maxY, maxZ);
		}
	}

	/**
	 * Push node's child in octant, with the part of node's region that
	 * octant covers. No-op when that octant is empty.
	 */
	private pushRegion(
		nodes: OctTreeElement<ItemT>[],
		regions: number[],
		node: OctTreeElement<ItemT>,
		octant: number,
		minX: number,
		minY: number,
		minZ: number,
		maxX: number,
		maxY: number,
		maxZ: number
	): void {
		const child = node._children[octant];

		if (!child) {
			return;
		}

		const lowX = (octant & 1) !== 0;
		const lowY = (octant & 2) !== 0;
		const lowZ = (octant & 4) !== 0;

		nodes.push(child);
		regions.push(
			lowX ? minX : node._x,
			lowY ? minY : node._y,
			lowZ ? minZ : node._z,
			lowX ? node._x : maxX,
			lowY ? node._y : maxY,
			lowZ ? node._z : maxZ
		);
	}

	/**
	 * Octant of node that position (x, y, z) falls in. A coordinate equal to
	 * node's falls on the larger side of its axis.
	 */
	private octantOf(node: OctTreeElement<ItemT>, x: number, y: number, z: number): OctTreeOctant {
		return ((x < node._x ? 1 : 0) | (y < node._y ? 2 : 0) | (z < node._z ? 4 : 0)) as OctTreeOctant;
	}

	/**
	 * First node at exactly (x, y, z) on its search path. Every node at that
	 * position lies on the path, since equal coordinates always descend the
	 * same way.
	 */
	private findAt(x: number, y: number, z: number): OctTreeElement<ItemT> | null {
		let curr = this._root;

		while (curr) {
			if (curr._x === x && curr._y === y && curr._z === z) {
				return curr;
			}

			curr = curr._children[this.octantOf(curr, x, y, z)];
		}

		return null;
	}

	private distanceSquared(node: OctTreeElement<ItemT>, point: OctTreePoint): number {
		const dx = node._x - point.x;
		const dy = node._y - point.y;
		const dz = node._z - point.z;

		return dx * dx + dy * dy + dz * dz;
	}

	private isPoint(point: unknown): point is OctTreePoint {
		if (typeof point !== 'object' || point === null) {
			return false;
		}

		const candidate = point as Partial<OctTreePoint>;

		return Number.isFinite(candidate.x) && Number.isFinite(candidate.y) && Number.isFinite(candidate.z);
	}

	private isBounds(bounds: unknown): bounds is OctTreeBounds {
		if (typeof bounds !== 'object' || bounds === null) {
			return false;
		}

		const {minX, minY, minZ, maxX, maxY, maxZ} = bounds as Partial<OctTreeBounds>;

		return (
			Number.isFinite(minX) &&
			Number.isFinite(minY) &&
			Number.isFinite(minZ) &&
			Number.isFinite(maxX) &&
			Number.isFinite(maxY) &&
			Number.isFinite(maxZ) &&
			(minX as number) <= (maxX as number) &&
			(minY as number) <= (maxY as number) &&
			(minZ as number) <= (maxZ as number)
		);
	}

	/**
	 * Node after node in pre-order: its first child, or else the next
	 * non-empty octant of the nearest ancestor that has one.
	 */
	private nextInPreOrder(node: OctTreeElement<ItemT>): OctTreeElement<ItemT> | null {
		for (const child of node._children) {
			if (child) {
				return child;
			}
		}

		let curr = node;

		while (curr._parent) {
			const parent = curr._parent;

			for (let octant = curr._octant + 1; octant < 8; octant++) {
				const sibling = parent._children[octant];

				if (sibling) {
					return sibling;
				}
			}

			curr = parent;
		}

		return null;
	}

	/** Clear node's parent and child links, keeping its item and ownership. */
	private clearLinks(node: OctTreeElement<ItemT>): void {
		node._parent = null;

		for (let octant = 0; octant < 8; octant++) {
			node._children[octant] = null;
		}

		node._octant = 0;
	}

	/**
	 * Clear node's links, position, and ownership. Needed even when pooling is
	 * off, where release does not blank the node.
	 */
	private unlink(node: OctTreeElement<ItemT>): void {
		this.clearLinks(node);
		node._x = 0;
		node._y = 0;
		node._z = 0;
		node._tree = null;
		node._linkId = 0;
	}

	private isPartOfTree(node: OctTreeElement<ItemT>): boolean {
		return node._tree === this;
	}

	/**
	 * Remove a query match, but only while element still holds the item it
	 * matched. A recycled element reissued to a later insert carries a new
	 * link id, so a stale result deletes nothing instead of the new item.
	 */
	private queryDelete(element: OctTreeElement<ItemT>, linkId: number): ItemT | null {
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
