import type {SpatialBounds} from './bounds';
import type {SpatialElement} from './element';
import {SpatialGrid} from './grid';
import type {SpatialHashError} from './hash/error';
import type {SpatialHashMethod} from './hash/method';
import type {SpatialHashOptions} from './hash/options';
import {SpatialIterator} from './iterator';
import type {SpatialLocator} from './locator';
import type {SpatialPoint} from './point';
import type {DataStructure} from '../data/structure';
import type {QueryFilter} from '../query/filter';
import type {QueryOptions} from '../query/options';
import type {QueryResult} from '../query/result';

/**
 * Uniform grid spatial hash: space is cut into cubic cells of `cellSize`, and
 * each item is filed under the cell holding the position its locator returns.
 * Any number of items may share a cell or an exact position. Only occupied
 * cells take memory, so space is unbounded in every direction. For a grid
 * holding at most one item per cell, use `SpatialMap`.
 *
 * Insert, remove, and moving an item with `update()` take O(1) on average,
 * whatever the distance moved: an item only changes cell lists when its cell
 * changes. Range and radius searches probe only the cells overlapping the
 * search region, and nearest neighbor search probes cube shells of cells
 * outward from the search point.
 *
 * Element wrappers are pooled by default (see `DataStructureOptions`).
 * `update()` moves the existing element, so an element handed out by
 * `insert()` keeps holding its item until that item is removed.
 *
 * Once the pool, the cell table, and the hash's internal scratch arrays have
 * grown, `insert()`, `remove()`, `removeNode()`, `update()`, `find()`,
 * `nearest()`, `forEach()`, `forEachWithinBounds()`, and
 * `forEachWithinRadius()` allocate nothing. `withinBounds()` and
 * `withinRadius()` allocate their result array, and may still allocate when
 * passed an array to fill (see their `out` parameter).
 *
 * @remarks
 * A spatial hash is fastest when items are spread over many cells and the
 * cell size is close to the typical query radius. Many items piled into one
 * cell make every search of that cell linear in their number.
 *
 * Each element stores the position its item was filed under, so the hash
 * cannot see an item move after it was inserted. After changing anything the
 * locator reads, call `update()` so the element is moved to the new position.
 *
 * Items are points. To find items with extent, such as spheres, pad each
 * search radius by the largest item radius and test the matches exactly.
 *
 * Iteration, `values()`, `toArray()`, `query()`, and `stringify()` follow
 * insertion order. Spatial searches follow cell order, which is unspecified.
 *
 * @category Spatial Hash
 */
export class SpatialHash<ItemT> implements DataStructure<ItemT> {
	/** Reads item positions. Required at construction, fixed for the hash's lifetime. */
	public readonly locator: SpatialLocator<ItemT>;
	/** Edge length of each cubic cell. */
	public readonly cellSize: number;
	/** Cell table, element links, and search walks. */
	private readonly grid: SpatialGrid<ItemT>;

	/**
	 * @param locator	Reads an item's position. Required, since items are
	 * 					generic and the hash cannot place them itself.
	 * @param data		Items inserted in array order on creation. Any other
	 * 					input is ignored, as are items without a valid position.
	 * @param options	Optional config. Each option falls back to its default
	 * 					when missing or invalid.
	 * @throws			When locator is not a function.
	 */
	constructor(locator: SpatialLocator<ItemT>, data?: ItemT[] | null, options?: SpatialHashOptions | null) {
		if (typeof locator !== 'function') {
			throw new Error('SpatialHash requires a locator function');
		}

		this.locator = locator;
		this.grid = new SpatialGrid<ItemT>(locator, options);
		this.cellSize = this.grid.cellSize;

		if (Array.isArray(data)) {
			this.insertArray(data);
		}
	}

	/**
	 * Iterate items in insertion order. Allocates one iterator per loop;
	 * `forEach()` is the non-allocating walk.
	 */
	[Symbol.iterator](): SpatialIterator<ItemT> {
		return new SpatialIterator<ItemT>(this.grid);
	}

	/**
	 * Insert item at the position its locator returns, in O(1) on average.
	 * @returns		The element now holding item, or `invalid_position` when the
	 * 				locator does not return finite x, y, and z coordinates in
	 * 				range. Nothing is added then.
	 */
	public insert(item: ItemT): SpatialElement<ItemT> | SpatialHashError {
		if (!this.grid.locate(item)) {
			return 'invalid_position';
		}

		return this.grid.insertLocated(item);
	}

	/**
	 * Insert each provided item, in array order. Items without a valid
	 * position are skipped.
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
	 * Find an element at exactly point, in O(1) on average plus the number of
	 * items in point's cell. When several items share that position, returns
	 * one of them.
	 * @returns		Matching element, or null when no item sits at point or point
	 * 				does not have finite x, y, and z coordinates.
	 */
	public find(point: SpatialPoint): SpatialElement<ItemT> | null {
		if (!this.grid.locatePoint(point)) {
			return null;
		}

		return this.grid.locatedExact();
	}

	/**
	 * Check whether any item sits at exactly point.
	 */
	public contains(point: SpatialPoint): boolean {
		return this.find(point) !== null;
	}

	/**
	 * Remove item itself, matched by strict equality like `Set.prototype.delete`.
	 * Only the cell holding the position the locator returns for item is
	 * searched, so an item moved in place must be passed to `update()` first,
	 * or removed with `removeNode()`.
	 * @returns		The removed item, or null when item is not in the hash.
	 */
	public remove(item: ItemT): ItemT | null {
		if (!this.grid.locate(item)) {
			return null;
		}

		for (let element = this.grid.locatedHead(); element; element = element._cellNext) {
			if (element._value === item) {
				return this.grid.remove(element);
			}
		}

		return null;
	}

	/**
	 * Unlink node from the hash and return its value, in O(1). With pooling
	 * on, the removed element is recycled and must not be used afterwards.
	 * @returns		The removed value, or null when node is null or not part of
	 * 				this hash (including an element that was already removed).
	 */
	public removeNode(node: SpatialElement<ItemT> | null): ItemT | null {
		if (!node || !this.grid.owns(node)) {
			return null;
		}

		return this.grid.remove(node);
	}

	/**
	 * Set node's item and move node to the item's position, in O(1) on average.
	 * For an item changed in place, pass the node's own item:
	 * `hash.update(node, node.value())`. A move inside the same cell only
	 * writes the new position. node keeps its place in insertion order.
	 *
	 * @returns		node, which keeps holding item. `invalid_position` when the
	 * 				locator does not return finite x, y, and z coordinates in
	 * 				range for item: node is removed then and item is no longer
	 * 				in the hash. Null when node is null or not part of this hash;
	 * 				nothing changes then.
	 */
	public update(
		node: SpatialElement<ItemT> | null,
		item: ItemT
	): SpatialElement<ItemT> | SpatialHashError | null {
		if (!node || !this.grid.owns(node)) {
			return null;
		}

		if (!this.grid.locate(item)) {
			this.grid.remove(node);
			return 'invalid_position';
		}

		node._value = item;
		this.grid.moveLocated(node);

		return node;
	}

	/**
	 * Elements whose positions lie inside bounds, faces included. Only cells
	 * overlapping bounds are searched. Shares its walk with
	 * `forEachWithinBounds()`, so both find the same elements in the same order.
	 * @param out	Optional array to fill instead of allocating a new one. Its
	 * 				previous contents are replaced and its length set to the
	 * 				match count. The array object is reused, but V8 shrinks its
	 * 				storage when the length drops, so a later call with more
	 * 				matches can allocate storage again. For zero allocation use
	 * 				`forEachWithinBounds()`.
	 * @returns		out when given, otherwise a new array, holding the matching
	 * 				elements. Empty when bounds has a non-finite value or a min
	 * 				greater than its max.
	 */
	public withinBounds(
		bounds: SpatialBounds,
		out?: SpatialElement<ItemT>[] | null
	): SpatialElement<ItemT>[] {
		const result: SpatialElement<ItemT>[] = Array.isArray(out) ? out : [];
		result.length = this.grid.collectWithinBounds(bounds, result, 0);

		return result;
	}

	/**
	 * Call func once for each element whose position lies inside bounds, faces
	 * included, in the order `withinBounds()` returns them. The zero-allocation
	 * form of `withinBounds()`. Visits nothing when the hash is empty, or
	 * bounds has a non-finite value or a min greater than its max.
	 *
	 * @remarks
	 * Safe under mutation, like `forEach()`: every match is collected before
	 * func first runs, and func is then called over that snapshot. func may
	 * insert, remove, update, or clear: removed matches not yet visited are
	 * skipped, moved matches are still visited once (even when no longer
	 * inside bounds), and inserted items are not visited. When func throws,
	 * the snapshot is released and the error propagates.
	 *
	 * @param func		Called with (element, index, hash). index counts visited
	 * 					matches from 0.
	 * @param thisArg	Value used as `this` when calling func, as passed. Like
	 * 					`Array.prototype.forEach`, `this` is undefined when omitted.
	 * @returns			This hash, like `forEach()`.
	 */
	public forEachWithinBounds(
		bounds: SpatialBounds,
		func: SpatialHashMethod<ItemT, void>,
		thisArg?: unknown
	): SpatialHash<ItemT> {
		this.grid.forEachWithinBounds(bounds, func, thisArg, this);

		return this;
	}

	/**
	 * Elements whose positions lie within radius of point, boundary included.
	 * Only cells overlapping the box around the search sphere are searched.
	 * Shares its walk with `forEachWithinRadius()`, so both find the same
	 * elements in the same order.
	 * @param out	Optional array to fill instead of allocating a new one, with
	 * 				the same rules as for `withinBounds()`.
	 * @returns		out when given, otherwise a new array, holding the matching
	 * 				elements. Empty when point does not have finite x, y, and z
	 * 				coordinates or radius is not a finite number of at least 0.
	 */
	public withinRadius(
		point: SpatialPoint,
		radius: number,
		out?: SpatialElement<ItemT>[] | null
	): SpatialElement<ItemT>[] {
		const result: SpatialElement<ItemT>[] = Array.isArray(out) ? out : [];
		result.length = this.grid.collectWithinRadius(point, radius, result, 0);

		return result;
	}

	/**
	 * Call func once for each element whose position lies within radius of
	 * point, boundary included, in the order `withinRadius()` returns them.
	 * The zero-allocation form of `withinRadius()`, safe under mutation with
	 * the same rules as `forEachWithinBounds()`. Visits nothing when the hash
	 * is empty, point does not have finite x, y, and z coordinates, or radius
	 * is not a finite number of at least 0.
	 *
	 * @param func		Called with (element, index, hash). index counts visited
	 * 					matches from 0.
	 * @param thisArg	Value used as `this` when calling func, as passed. Like
	 * 					`Array.prototype.forEach`, `this` is undefined when omitted.
	 * @returns			This hash, like `forEach()`.
	 */
	public forEachWithinRadius(
		point: SpatialPoint,
		radius: number,
		func: SpatialHashMethod<ItemT, void>,
		thisArg?: unknown
	): SpatialHash<ItemT> {
		this.grid.forEachWithinRadius(point, radius, func, thisArg, this);

		return this;
	}

	/**
	 * Element whose position is nearest to point by straight-line distance.
	 * Cells are searched in cube shells outward from point's cell until no
	 * unsearched cell can hold anything nearer. Costs at most O(n), when items
	 * are sparse around point. Allocates nothing.
	 * @returns		Nearest element, or null when the hash is empty or point does
	 * 				not have finite x, y, and z coordinates. When several are
	 * 				equally near, one of them.
	 */
	public nearest(point: SpatialPoint): SpatialElement<ItemT> | null {
		return this.grid.nearest(point);
	}

	/**
	 * Get number of items in the hash.
	 * @returns		Hash size as a positive integer, or 0 if empty.
	 */
	public size(): number {
		return this.grid.size();
	}

	/**
	 * Quickly check whether the hash has items.
	 */
	public isEmpty(): boolean {
		return this.grid.size() === 0;
	}

	/**
	 * Number of cells holding at least one item.
	 */
	public cellCount(): number {
		return this.grid.cellCount();
	}

	/**
	 * Create a new hash containing only the items of elements for which func
	 * returns true, inserted in insertion order. The new hash uses this hash's
	 * locator and options.
	 * @param func		Called with (element, index, hash) in insertion order.
	 * @param thisArg	Value used as `this` when calling func, as passed. Like
	 * 					`Array.prototype.filter`, `this` is undefined when omitted.
	 */
	public filter(func: SpatialHashMethod<ItemT, boolean>, thisArg?: unknown): SpatialHash<ItemT> {
		return new SpatialHash<ItemT>(this.locator, this.filterValues(func, thisArg), this.options());
	}

	/**
	 * Items of elements for which func returns true, in insertion order.
	 * Subclasses build their own `filter()` result from this.
	 */
	protected filterValues(func: SpatialHashMethod<ItemT, boolean>, thisArg?: unknown): ItemT[] {
		return this.grid.filterValues(func, thisArg, this);
	}

	/**
	 * Options equivalent to the ones this hash was built with, for creating
	 * derived hashes that behave the same way.
	 */
	protected options(): SpatialHashOptions {
		return this.grid.options();
	}

	/**
	 * Call func for each element in insertion order. The non-allocating way to
	 * walk the hash: it reuses internal scratch arrays, so once they have grown
	 * to the hash's size a call allocates nothing.
	 *
	 * @remarks
	 * Like `Map` / `Set`, func receives the hash itself as its third argument,
	 * not an array. The walk runs over a snapshot of the elements taken before
	 * func first runs. func may remove or update any element: removed elements
	 * not yet visited are skipped, and moved ones are still visited once.
	 * Elements inserted during the walk are not visited. func may also start
	 * another `forEach()` on this hash.
	 *
	 * @param func		Called with (element, index, hash) in insertion order.
	 * @param thisArg	Value used as `this` when calling func, as passed. Like
	 * 					`Array.prototype.forEach`, `this` is undefined when omitted.
	 */
	public forEach(func: SpatialHashMethod<ItemT, void>, thisArg?: unknown): SpatialHash<ItemT> {
		this.grid.forEach(func, thisArg, this);

		return this;
	}

	/**
	 * Every item, in insertion order.
	 */
	public values(): ItemT[] {
		return this.grid.values();
	}

	/**
	 * Serialize hash items, in insertion order, to a JSON string.
	 * @returns		JSON string, or null when an item cannot be serialized
	 * 				(e.g. items contain circular references or BigInt values).
	 */
	public stringify(): string | null {
		try {
			return JSON.stringify({type: 'SpatialHash', elements: this.values()});
		} catch {
			return null;
		}
	}

	/**
	 * Every element, in insertion order.
	 */
	public toArray(): SpatialElement<ItemT>[] {
		return this.grid.toArray();
	}

	/**
	 * Find elements whose items pass every filter, in insertion order. Each
	 * result's `delete()` removes its element, and does nothing once that
	 * element has been removed some other way. Allocates the result array and
	 * one result per match.
	 */
	public query(
		filters: QueryFilter<ItemT> | QueryFilter<ItemT>[],
		opts?: QueryOptions
	): QueryResult<SpatialElement<ItemT>, ItemT>[] {
		return this.grid.query(filters, opts);
	}

	/**
	 * Unlink and drop every element. Elements removed this way are blanked,
	 * and recycled when pooling is on. The cell table keeps its capacity.
	 * Allocates nothing.
	 */
	public clearElements(): SpatialHash<ItemT> {
		this.grid.clear();

		return this;
	}

	/**
	 * Restore the hash to its freshly constructed state. The locator and
	 * constructor options are kept.
	 */
	public reset(): SpatialHash<ItemT> {
		this.grid.clear();

		return this;
	}
}
