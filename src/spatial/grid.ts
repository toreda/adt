import {SpatialElement} from './element';
import type {SpatialBounds} from './bounds';
import type {SpatialGridOptions} from './grid/options';
import type {SpatialGridVisitor} from './grid/visitor';
import type {SpatialLocator} from './locator';
import type {SpatialPoint} from './point';
import {ElementPool} from '../element/pool';
import type {ObjectPoolConstructor} from '../object/pool/constructor';
import type {QueryFilter} from '../query/filter';
import type {QueryOptions} from '../query/options';
import type {QueryResult} from '../query/result';
import {intValue} from '../int/value';
import {isNumber} from '../utility';

/** Cell table slot states. */
const SLOT_EMPTY = 0;
const SLOT_LIVE = 1;
const SLOT_TOMBSTONE = 2;
/** Cell coordinates are stored as int32, so each axis spans this range. */
const CELL_MIN = -2147483648;
const CELL_MAX = 2147483647;
/** Rebuild the table when live cells plus tombstones exceed this fraction of it. */
const TABLE_LOAD_LIMIT = 0.7;
/** Double the table, instead of sweeping it in place, when live cells alone exceed this fraction. */
const TABLE_GROW_LIMIT = 0.5;
/** Smallest cell table. A power of two, like every table size. */
const TABLE_MIN_CAPACITY = 8;
const DEFAULT_CELL_SIZE = 1;
const DEFAULT_EXPECTED_CELL_COUNT = 64;
/** Which test `matches()` applies during a box walk. */
const MATCH_BOUNDS = 0;
const MATCH_RADIUS = 1;

/** Shared by every query result: a spatial grid has no keys. */
const queryNoKey = (): string | null => null;
/** Shared by every query result: a spatial grid has no indexes. */
const queryNoIndex = (): number | null => null;

function nextPow2(n: number): number {
	let p = 1;

	while (p < n) {
		p *= 2;
	}

	return p;
}

function clampCell(cell: number): number {
	if (cell < CELL_MIN) {
		return CELL_MIN;
	}

	return cell > CELL_MAX ? CELL_MAX : cell;
}

/**
 * Uniform grid engine shared by `SpatialHash` and `SpatialMap`, in the way
 * `ElementPool` is shared by node-based data structures. Space is cut into
 * cubic cells of `cellSize`. Occupied cells live in an open-addressed hash
 * table keyed by their integer coordinates, with linear probing, and each cell
 * heads an intrusive doubly linked list of its elements. A second intrusive
 * list keeps every element in insertion order for iteration.
 *
 * The grid does not decide how many items a cell may hold: `SpatialHash`
 * allows any number and `SpatialMap` at most one. Callers use the data
 * structures, not the grid.
 *
 * Once the element pool, the cell table, and the scratch arrays have grown,
 * linking, moving, unlinking, and every visitor allocate nothing. The table
 * only allocates when it doubles.
 *
 * @category Spatial
 */
export class SpatialGrid<ItemT> {
	/** Reads item positions. Fixed for the grid's lifetime. */
	public readonly locator: SpatialLocator<ItemT>;
	/** Edge length of each cubic cell. */
	public readonly cellSize: number;
	/** Cell count the table was sized for at construction. */
	public readonly expectedCellCount: number;
	private readonly invCellSize: number;
	private _size: number;
	/** Oldest and newest elements, the ends of the insertion order list. */
	private _first: SpatialElement<ItemT> | null;
	private _last: SpatialElement<ItemT> | null;
	/** Last id handed to a linked element. Only increases, so ids never repeat. */
	private lastLinkId: number;
	/** Source of element wrappers, pooled or freshly allocated per options. */
	private readonly elements: ElementPool<SpatialElement<ItemT>>;
	/** Cell table, one entry per slot: coordinates, state, and list head. */
	private tableX: Int32Array;
	private tableY: Int32Array;
	private tableZ: Int32Array;
	private tableState: Uint8Array;
	private tableHead: (SpatialElement<ItemT> | null)[];
	private tableCapacity: number;
	private tableMask: number;
	private rebuildThreshold: number;
	private liveCells: number;
	private tombstones: number;
	/** Position and cell found by the last successful `locate()` or `locatePoint()`. */
	private locX: number;
	private locY: number;
	private locZ: number;
	private locCellX: number;
	private locCellY: number;
	private locCellZ: number;
	/** Test applied by `matches()` during the current box walk, and its inputs. */
	private matchMode: number;
	private matchX: number;
	private matchY: number;
	private matchZ: number;
	private matchMinX: number;
	private matchMinY: number;
	private matchMinZ: number;
	private matchMaxX: number;
	private matchMaxY: number;
	private matchMaxZ: number;
	private matchRadiusSq: number;
	/**
	 * Snapshot of the elements `forEach()` and the visitors walk, and their link
	 * ids. The callback may call anything, including another visitor, which
	 * stacks its own snapshot above this one.
	 */
	private readonly eachNodes: (SpatialElement<ItemT> | null)[];
	private readonly eachLinkIds: number[];
	/** Number of snapshot entries in use by running visitors. */
	private eachTop: number;

	/**
	 * @param locator	Reads an item's position.
	 * @param options	Optional config. Each option falls back to its default
	 * 					when missing or invalid.
	 */
	constructor(locator: SpatialLocator<ItemT>, options?: SpatialGridOptions | null) {
		const cellSize = options?.cellSize;

		this.locator = locator;
		this.cellSize =
			typeof cellSize === 'number' && Number.isFinite(cellSize) && cellSize > 0
				? cellSize
				: DEFAULT_CELL_SIZE;
		this.invCellSize = 1 / this.cellSize;
		const expectedCellCount = intValue(DEFAULT_EXPECTED_CELL_COUNT, options?.expectedCellCount);
		this.expectedCellCount = expectedCellCount >= 1 ? expectedCellCount : DEFAULT_EXPECTED_CELL_COUNT;

		this._size = 0;
		this._first = null;
		this._last = null;
		this.lastLinkId = 0;
		// The element class is generic and the pool builds blank elements with no
		// value, so any ItemT instantiation is valid here.
		this.elements = new ElementPool(
			SpatialElement as ObjectPoolConstructor<SpatialElement<ItemT>>,
			options
		);

		this.tableCapacity = Math.max(TABLE_MIN_CAPACITY, nextPow2(2 * this.expectedCellCount));
		this.tableMask = this.tableCapacity - 1;
		this.rebuildThreshold = Math.floor(this.tableCapacity * TABLE_LOAD_LIMIT);
		this.tableX = new Int32Array(this.tableCapacity);
		this.tableY = new Int32Array(this.tableCapacity);
		this.tableZ = new Int32Array(this.tableCapacity);
		this.tableState = new Uint8Array(this.tableCapacity);
		this.tableHead = new Array(this.tableCapacity).fill(null);
		this.liveCells = 0;
		this.tombstones = 0;

		this.locX = 0;
		this.locY = 0;
		this.locZ = 0;
		this.locCellX = 0;
		this.locCellY = 0;
		this.locCellZ = 0;
		this.matchMode = MATCH_BOUNDS;
		this.matchX = 0;
		this.matchY = 0;
		this.matchZ = 0;
		this.matchMinX = 0;
		this.matchMinY = 0;
		this.matchMinZ = 0;
		this.matchMaxX = 0;
		this.matchMaxY = 0;
		this.matchMaxZ = 0;
		this.matchRadiusSq = 0;
		this.eachNodes = [];
		this.eachLinkIds = [];
		this.eachTop = 0;
	}

	/** Number of linked elements. */
	public size(): number {
		return this._size;
	}

	/** Number of cells holding at least one element. */
	public cellCount(): number {
		return this.liveCells;
	}

	/** Oldest linked element, or null when the grid is empty. */
	public first(): SpatialElement<ItemT> | null {
		return this._first;
	}

	public owns(element: SpatialElement<ItemT>): boolean {
		return element._grid === this;
	}

	/** Integer cell coordinate holding value along one axis. */
	public cellCoord(value: number): number {
		const cell = Math.floor(value * this.invCellSize);

		// A -0 position floors to cell -0, which callers would see in cellX().
		return cell === 0 ? 0 : cell;
	}

	/**
	 * Read item's position with the locator and store it, with its cell, for
	 * the next `*Located` call.
	 * @returns		False when the position is not finite on every axis or its
	 * 				cell lies outside the int32 range of cell coordinates.
	 */
	public locate(item: ItemT): boolean {
		return this.locatePoint(this.locator(item));
	}

	/** Same as `locate()`, for a point instead of an item. */
	public locatePoint(point: unknown): boolean {
		if (!this.isPoint(point)) {
			return false;
		}

		const x = point.x;
		const y = point.y;
		const z = point.z;
		const cellX = this.cellCoord(x);
		const cellY = this.cellCoord(y);
		const cellZ = this.cellCoord(z);

		if (
			cellX < CELL_MIN ||
			cellX > CELL_MAX ||
			cellY < CELL_MIN ||
			cellY > CELL_MAX ||
			cellZ < CELL_MIN ||
			cellZ > CELL_MAX
		) {
			return false;
		}

		this.locX = x;
		this.locY = y;
		this.locZ = z;
		this.locCellX = cellX;
		this.locCellY = cellY;
		this.locCellZ = cellZ;

		return true;
	}

	/** First element of the located cell, or null when that cell is empty. */
	public locatedHead(): SpatialElement<ItemT> | null {
		return this.cellHead(this.locCellX, this.locCellY, this.locCellZ);
	}

	/** First element at exactly the located position, or null when there is none. */
	public locatedExact(): SpatialElement<ItemT> | null {
		for (let element = this.locatedHead(); element; element = element._cellNext) {
			if (element._x === this.locX && element._y === this.locY && element._z === this.locZ) {
				return element;
			}
		}

		return null;
	}

	/** Whether element's cell is the located cell. */
	public locatedInCellOf(element: SpatialElement<ItemT>): boolean {
		return (
			element._cellX === this.locCellX &&
			element._cellY === this.locCellY &&
			element._cellZ === this.locCellZ
		);
	}

	/**
	 * First element of cell (cellX, cellY, cellZ), in O(1) on average.
	 * @returns		Cell head, or null when the cell is empty.
	 */
	public cellHead(cellX: number, cellY: number, cellZ: number): SpatialElement<ItemT> | null {
		const slot = this.findSlot(cellX, cellY, cellZ);

		return slot !== -1 ? this.tableHead[slot] : null;
	}

	/**
	 * Link item at the located position, newest in insertion order, in O(1) on
	 * average.
	 * @returns		The new element.
	 */
	public insertLocated(item: ItemT): SpatialElement<ItemT> {
		const element = this.elements.allocate();

		element._value = item;
		element._grid = this;
		element._linkId = ++this.lastLinkId;
		this.placeLocated(element);
		this.linkCell(element);

		element._prev = this._last;
		element._next = null;

		if (this._last) {
			this._last._next = element;
		} else {
			this._first = element;
		}

		this._last = element;
		this._size++;

		return element;
	}

	/**
	 * Move a linked element to the located position, keeping its place in
	 * insertion order. Only relinks when the cell changes; a move inside the
	 * same cell writes the position and nothing else.
	 */
	public moveLocated(element: SpatialElement<ItemT>): void {
		if (this.locatedInCellOf(element)) {
			element._x = this.locX;
			element._y = this.locY;
			element._z = this.locZ;
			return;
		}

		this.unlinkCell(element);
		this.placeLocated(element);
		this.linkCell(element);
	}

	/**
	 * Unlink a linked element and hand it back to the element pool.
	 * @returns		The element's item.
	 */
	public remove(element: SpatialElement<ItemT>): ItemT {
		const value = element._value as ItemT;
		const prev = element._prev;
		const next = element._next;

		this.unlinkCell(element);

		if (prev) {
			prev._next = next;
		} else {
			this._first = next;
		}

		if (next) {
			next._prev = prev;
		} else {
			this._last = prev;
		}

		this._size--;
		this.dropElement(element);

		return value;
	}

	/**
	 * Unlink and drop every element, keeping the table's capacity. Allocates
	 * nothing.
	 */
	public clear(): void {
		let element = this._first;

		this._first = null;
		this._last = null;
		this._size = 0;

		while (element) {
			const next = element._next;
			this.dropElement(element);
			element = next;
		}

		this.tableState.fill(SLOT_EMPTY);
		this.tableHead.fill(null);
		this.liveCells = 0;
		this.tombstones = 0;
	}

	/**
	 * Write every element inside bounds into `into` from index start on. Order
	 * follows cells, not insertion.
	 * @returns		Index after the last element written; start when nothing
	 * 				matches or bounds is invalid.
	 */
	public collectWithinBounds(
		bounds: SpatialBounds,
		into: (SpatialElement<ItemT> | null)[],
		start: number
	): number {
		if (this._size === 0 || !this.isBounds(bounds)) {
			return start;
		}

		this.matchMode = MATCH_BOUNDS;
		this.matchMinX = bounds.minX;
		this.matchMinY = bounds.minY;
		this.matchMinZ = bounds.minZ;
		this.matchMaxX = bounds.maxX;
		this.matchMaxY = bounds.maxY;
		this.matchMaxZ = bounds.maxZ;

		return this.collectBox(into, start);
	}

	/**
	 * Write every element within radius of point into `into` from index start
	 * on. Order follows cells, not insertion.
	 * @returns		Index after the last element written; start when nothing
	 * 				matches or point or radius is invalid.
	 */
	public collectWithinRadius(
		point: SpatialPoint,
		radius: number,
		into: (SpatialElement<ItemT> | null)[],
		start: number
	): number {
		if (this._size === 0 || !this.isPoint(point) || !Number.isFinite(radius) || radius < 0) {
			return start;
		}

		this.matchMode = MATCH_RADIUS;
		this.matchX = point.x;
		this.matchY = point.y;
		this.matchZ = point.z;
		this.matchMinX = point.x - radius;
		this.matchMinY = point.y - radius;
		this.matchMinZ = point.z - radius;
		this.matchMaxX = point.x + radius;
		this.matchMaxY = point.y + radius;
		this.matchMaxZ = point.z + radius;
		this.matchRadiusSq = radius * radius;

		return this.collectBox(into, start);
	}

	/**
	 * Element nearest to point by straight-line distance. Searches cube shells
	 * of cells outward from the cell holding point, and stops once no unsearched
	 * cell can hold anything nearer. When a shell would probe more cells than
	 * there are elements, it measures every element instead, so a call never
	 * costs more than O(n). Allocates nothing.
	 * @returns		Nearest element, or null when the grid is empty or point does
	 * 				not have finite x, y, and z coordinates. When several are
	 * 				equally near, one of them.
	 */
	public nearest(point: SpatialPoint): SpatialElement<ItemT> | null {
		if (this._size === 0 || !this.isPoint(point)) {
			return null;
		}

		const px = point.x;
		const py = point.y;
		const pz = point.z;
		const rawX = this.cellCoord(px);
		const rawY = this.cellCoord(py);
		const rawZ = this.cellCoord(pz);
		const centerX = clampCell(rawX);
		const centerY = clampCell(rawY);
		const centerZ = clampCell(rawZ);
		// Shell distance bounds assume point lies inside the center cell.
		const inRange = centerX === rawX && centerY === rawY && centerZ === rawZ;
		let best: SpatialElement<ItemT> | null = null;
		let bestSq = Infinity;

		for (let ring = 0; inRange; ring++) {
			const side = 2 * ring + 1;
			const inner = side - 2;
			const shellCells = ring === 0 ? 1 : side * side * side - inner * inner * inner;

			if (shellCells > this._size) {
				break;
			}

			for (let dx = -ring; dx <= ring; dx++) {
				const edgeX = dx === -ring || dx === ring;

				for (let dy = -ring; dy <= ring; dy++) {
					// Off the shell's x and y faces only the two z faces are on it.
					const step = edgeX || dy === -ring || dy === ring ? 1 : 2 * ring;

					for (let dz = -ring; dz <= ring; dz += step) {
						const slot = this.findSlot(centerX + dx, centerY + dy, centerZ + dz);

						if (slot === -1) {
							continue;
						}

						for (let element = this.tableHead[slot]; element; element = element._cellNext) {
							const distanceSq = this.distanceSquared(element, px, py, pz);

							if (distanceSq < bestSq) {
								best = element;
								bestSq = distanceSq;
							}
						}
					}
				}
			}

			// Every unsearched cell is at least ring cells away. One cell of slack
			// covers rounding in the cell coordinate of positions on cell faces.
			const reach = (ring - 1) * this.cellSize;

			if (best && ring >= 1 && bestSq <= reach * reach) {
				return best;
			}
		}

		for (let element = this._first; element; element = element._next) {
			const distanceSq = this.distanceSquared(element, px, py, pz);

			if (distanceSq < bestSq) {
				best = element;
				bestSq = distanceSq;
			}
		}

		return best;
	}

	/**
	 * Call func for each element in insertion order, over a snapshot taken
	 * before func first runs. See `visit()` for the mutation rules.
	 */
	public forEach<OwnerT>(func: SpatialGridVisitor<ItemT, OwnerT>, thisArg: unknown, owner: OwnerT): void {
		const nodes = this.eachNodes;
		const start = this.eachTop;
		let end = start;

		for (let element = this._first; element; element = element._next) {
			nodes[end++] = element;
		}

		this.visit(start, end, func, thisArg, owner);
	}

	/** Call func for each element inside bounds, over a snapshot. */
	public forEachWithinBounds<OwnerT>(
		bounds: SpatialBounds,
		func: SpatialGridVisitor<ItemT, OwnerT>,
		thisArg: unknown,
		owner: OwnerT
	): void {
		const start = this.eachTop;
		const end = this.collectWithinBounds(bounds, this.eachNodes, start);

		this.visit(start, end, func, thisArg, owner);
	}

	/** Call func for each element within radius of point, over a snapshot. */
	public forEachWithinRadius<OwnerT>(
		point: SpatialPoint,
		radius: number,
		func: SpatialGridVisitor<ItemT, OwnerT>,
		thisArg: unknown,
		owner: OwnerT
	): void {
		const start = this.eachTop;
		const end = this.collectWithinRadius(point, radius, this.eachNodes, start);

		this.visit(start, end, func, thisArg, owner);
	}

	/** Items of elements for which func returns true, in insertion order. */
	public filterValues<OwnerT>(
		func: SpatialGridVisitor<ItemT, OwnerT>,
		thisArg: unknown,
		owner: OwnerT
	): ItemT[] {
		const values: ItemT[] = [];

		this.forEach(
			(element, index, target) => {
				if (func.call(thisArg, element, index, target)) {
					values.push(element._value as ItemT);
				}
			},
			undefined,
			owner
		);

		return values;
	}

	/** Every item, in insertion order. */
	public values(): ItemT[] {
		const values: ItemT[] = [];

		for (let element = this._first; element; element = element._next) {
			values.push(element._value as ItemT);
		}

		return values;
	}

	/** Every element, in insertion order. */
	public toArray(): SpatialElement<ItemT>[] {
		const result: SpatialElement<ItemT>[] = [];

		for (let element = this._first; element; element = element._next) {
			result.push(element);
		}

		return result;
	}

	/**
	 * Elements whose items pass every filter, in insertion order. Each result's
	 * `delete()` removes its element, and does nothing once that element has
	 * been removed some other way.
	 */
	public query(
		filters: QueryFilter<ItemT> | QueryFilter<ItemT>[],
		opts?: QueryOptions
	): QueryResult<SpatialElement<ItemT>, ItemT>[] {
		const results: QueryResult<SpatialElement<ItemT>, ItemT>[] = [];
		const limit = this.queryLimit(opts);
		let element = this._first;

		// Stops walking as soon as the limit is reached.
		while (element && results.length < limit) {
			const match = element;
			element = element._next;

			if (!this.queryMatch(filters, match._value as ItemT)) {
				continue;
			}

			const linkId = match._linkId;

			results.push({
				element: match,
				key: queryNoKey,
				index: queryNoIndex,
				delete: (): ItemT | null =>
					match._grid === this && match._linkId === linkId ? this.remove(match) : null
			});
		}

		return results;
	}

	/**
	 * Options equivalent to the ones this grid was built with, for creating
	 * derived data structures that behave the same way.
	 */
	public options(): SpatialGridOptions {
		return {
			...this.elements.options(),
			cellSize: this.cellSize,
			expectedCellCount: this.expectedCellCount
		};
	}

	/**
	 * Write every element inside the match box that passes `matches()` into
	 * `into` from index count on. Probes each cell of the box when the box has
	 * no more cells than the table has slots, and otherwise scans the table's
	 * occupied cells, so a huge box costs no more than a full scan.
	 */
	private collectBox(into: (SpatialElement<ItemT> | null)[], start: number): number {
		const minX = clampCell(this.cellCoord(this.matchMinX));
		const minY = clampCell(this.cellCoord(this.matchMinY));
		const minZ = clampCell(this.cellCoord(this.matchMinZ));
		const maxX = clampCell(this.cellCoord(this.matchMaxX));
		const maxY = clampCell(this.cellCoord(this.matchMaxY));
		const maxZ = clampCell(this.cellCoord(this.matchMaxZ));
		const boxCells = (maxX - minX + 1) * (maxY - minY + 1) * (maxZ - minZ + 1);
		let count = start;

		if (boxCells <= this.tableCapacity) {
			for (let cellX = minX; cellX <= maxX; cellX++) {
				for (let cellY = minY; cellY <= maxY; cellY++) {
					for (let cellZ = minZ; cellZ <= maxZ; cellZ++) {
						const slot = this.findSlot(cellX, cellY, cellZ);

						if (slot !== -1) {
							count = this.collectCell(slot, into, count);
						}
					}
				}
			}

			return count;
		}

		const state = this.tableState;
		const tableX = this.tableX;
		const tableY = this.tableY;
		const tableZ = this.tableZ;

		for (let slot = 0; slot < this.tableCapacity; slot++) {
			if (
				state[slot] === SLOT_LIVE &&
				tableX[slot] >= minX &&
				tableX[slot] <= maxX &&
				tableY[slot] >= minY &&
				tableY[slot] <= maxY &&
				tableZ[slot] >= minZ &&
				tableZ[slot] <= maxZ
			) {
				count = this.collectCell(slot, into, count);
			}
		}

		return count;
	}

	/** Write the elements of the cell in slot that pass `matches()`. */
	private collectCell(slot: number, into: (SpatialElement<ItemT> | null)[], start: number): number {
		let count = start;

		for (let element = this.tableHead[slot]; element; element = element._cellNext) {
			if (this.matches(element)) {
				into[count++] = element;
			}
		}

		return count;
	}

	private matches(element: SpatialElement<ItemT>): boolean {
		if (this.matchMode === MATCH_RADIUS) {
			return this.distanceSquared(element, this.matchX, this.matchY, this.matchZ) <= this.matchRadiusSq;
		}

		return (
			element._x >= this.matchMinX &&
			element._x <= this.matchMaxX &&
			element._y >= this.matchMinY &&
			element._y <= this.matchMaxY &&
			element._z >= this.matchMinZ &&
			element._z <= this.matchMaxZ
		);
	}

	/**
	 * Call func for each element in `eachNodes` from start to end that is still
	 * linked to this grid under the id it had when written there. Claims that
	 * range of the snapshot for the call, so func may start another visitor,
	 * which stacks above it, and releases it afterwards even when func throws.
	 *
	 * func may insert, remove, update, or clear: removed elements not yet
	 * visited are skipped, moved ones are still visited once, and inserted ones
	 * are not visited.
	 */
	private visit<OwnerT>(
		start: number,
		end: number,
		func: SpatialGridVisitor<ItemT, OwnerT>,
		thisArg: unknown,
		owner: OwnerT
	): void {
		const nodes = this.eachNodes;
		const linkIds = this.eachLinkIds;

		for (let i = start; i < end; i++) {
			linkIds[i] = (nodes[i] as SpatialElement<ItemT>)._linkId;
		}

		this.eachTop = end;

		try {
			let index = 0;

			for (let i = start; i < end; i++) {
				const element = nodes[i] as SpatialElement<ItemT>;

				// A removed element may have been recycled for a later insert, which
				// gives it a new link id.
				if (element._grid !== this || element._linkId !== linkIds[i]) {
					continue;
				}

				func.call(thisArg, element, index, owner);
				index++;
			}
		} finally {
			// Drop the references so removed elements are not kept alive.
			for (let i = start; i < end; i++) {
				nodes[i] = null;
			}

			this.eachTop = start;
		}
	}

	/** Copy the located position and cell into element. */
	private placeLocated(element: SpatialElement<ItemT>): void {
		element._x = this.locX;
		element._y = this.locY;
		element._z = this.locZ;
		element._cellX = this.locCellX;
		element._cellY = this.locCellY;
		element._cellZ = this.locCellZ;
	}

	/**
	 * Hash cell coordinates to a table slot. Each axis is spread with a
	 * Math.imul odd-constant multiply, the three are xor-combined, and the
	 * result is finalized murmur3-style so every coordinate bit affects the low
	 * bits the mask keeps.
	 */
	private hashCell(cellX: number, cellY: number, cellZ: number): number {
		let h = Math.imul(cellX, 0x8da6b343) ^ Math.imul(cellY, 0xd8163841) ^ Math.imul(cellZ, 0xcb1ab31f);

		h ^= h >>> 16;
		h = Math.imul(h, 0x85ebca6b);
		h ^= h >>> 13;
		h = Math.imul(h, 0xc2b2ae35);
		h ^= h >>> 16;

		return h & this.tableMask;
	}

	/**
	 * Probe for an occupied cell. The load limit guarantees empty slots exist,
	 * so probing terminates. Coordinates outside the int32 range never match,
	 * since stored coordinates are int32.
	 * @returns		The cell's table slot, or -1 when the cell is empty.
	 */
	private findSlot(cellX: number, cellY: number, cellZ: number): number {
		const mask = this.tableMask;
		const state = this.tableState;
		let slot = this.hashCell(cellX, cellY, cellZ);

		while (state[slot] !== SLOT_EMPTY) {
			if (
				state[slot] === SLOT_LIVE &&
				this.tableX[slot] === cellX &&
				this.tableY[slot] === cellY &&
				this.tableZ[slot] === cellZ
			) {
				return slot;
			}

			slot = (slot + 1) & mask;
		}

		return -1;
	}

	/**
	 * Probe for the slot a cell belongs in: its own slot when occupied,
	 * otherwise the first tombstone on the probe path, otherwise the empty slot
	 * ending it.
	 */
	private findSlotForInsert(cellX: number, cellY: number, cellZ: number): number {
		const mask = this.tableMask;
		const state = this.tableState;
		let slot = this.hashCell(cellX, cellY, cellZ);
		let firstTombstone = -1;

		while (state[slot] !== SLOT_EMPTY) {
			if (state[slot] === SLOT_LIVE) {
				if (
					this.tableX[slot] === cellX &&
					this.tableY[slot] === cellY &&
					this.tableZ[slot] === cellZ
				) {
					return slot;
				}
			} else if (firstTombstone === -1) {
				firstTombstone = slot;
			}

			slot = (slot + 1) & mask;
		}

		return firstTombstone !== -1 ? firstTombstone : slot;
	}

	/**
	 * Link element at the head of its cell's list, creating the cell when
	 * needed. element must not be linked into any cell (`_slot` is -1).
	 */
	private linkCell(element: SpatialElement<ItemT>): void {
		const cellX = element._cellX;
		const cellY = element._cellY;
		const cellZ = element._cellZ;
		let slot = this.findSlotForInsert(cellX, cellY, cellZ);

		if (this.tableState[slot] !== SLOT_LIVE) {
			// A new cell. Never triggers while a rebuild relinks: the rebuild sizes
			// the table so every live cell fits below the grow limit, which is
			// below the load limit.
			if (this.liveCells + this.tombstones + 1 > this.rebuildThreshold) {
				this.rebuildTable();
				slot = this.findSlotForInsert(cellX, cellY, cellZ);
			}

			if (this.tableState[slot] === SLOT_TOMBSTONE) {
				this.tombstones--;
			}

			this.tableState[slot] = SLOT_LIVE;
			this.tableX[slot] = cellX;
			this.tableY[slot] = cellY;
			this.tableZ[slot] = cellZ;
			this.tableHead[slot] = null;
			this.liveCells++;
		}

		const head = this.tableHead[slot];

		element._cellNext = head;
		element._cellPrev = null;

		if (head) {
			head._cellPrev = element;
		}

		this.tableHead[slot] = element;
		element._slot = slot;
	}

	/**
	 * Unlink element from its cell in O(1), freeing the cell when its list
	 * empties. Leaves `_slot` at -1.
	 */
	private unlinkCell(element: SpatialElement<ItemT>): void {
		const slot = element._slot;
		const next = element._cellNext;
		const prev = element._cellPrev;

		if (prev) {
			prev._cellNext = next;
		} else {
			this.tableHead[slot] = next;
		}

		if (next) {
			next._cellPrev = prev;
		}

		if (this.tableHead[slot] === null) {
			this.liveCells--;

			// No probe path continues past an empty slot, so when the next slot
			// is empty this one can be emptied too instead of tombstoned.
			if (this.tableState[(slot + 1) & this.tableMask] === SLOT_EMPTY) {
				this.tableState[slot] = SLOT_EMPTY;
			} else {
				this.tableState[slot] = SLOT_TOMBSTONE;
				this.tombstones++;
			}
		}

		element._cellNext = null;
		element._cellPrev = null;
		element._slot = -1;
	}

	/**
	 * Clear tombstones by relinking every element into an empty table: at the
	 * same capacity, allocating nothing, or at a doubled capacity when live
	 * cells alone crowd the table. An element waiting to be linked (`_slot` is
	 * -1) is skipped; its caller links it after the rebuild.
	 */
	private rebuildTable(): void {
		const needed = this.liveCells + 1;
		let capacity = this.tableCapacity;

		while (needed > Math.floor(capacity * TABLE_GROW_LIMIT)) {
			capacity *= 2;
		}

		if (capacity !== this.tableCapacity) {
			this.tableX = new Int32Array(capacity);
			this.tableY = new Int32Array(capacity);
			this.tableZ = new Int32Array(capacity);
			this.tableState = new Uint8Array(capacity);
			this.tableHead = new Array(capacity).fill(null);
			this.tableCapacity = capacity;
			this.tableMask = capacity - 1;
			this.rebuildThreshold = Math.floor(capacity * TABLE_LOAD_LIMIT);
		} else {
			this.tableState.fill(SLOT_EMPTY);
			this.tableHead.fill(null);
		}

		this.liveCells = 0;
		this.tombstones = 0;

		for (let element = this._first; element; element = element._next) {
			if (element._slot !== -1) {
				element._slot = -1;
				this.linkCell(element);
			}
		}
	}

	private distanceSquared(element: SpatialElement<ItemT>, x: number, y: number, z: number): number {
		const dx = element._x - x;
		const dy = element._y - y;
		const dz = element._z - z;

		return dx * dx + dy * dy + dz * dz;
	}

	/**
	 * Hand an element that is already out of the grid back to the element pool.
	 * With pooling on, release blanks every field. With it off, the element is
	 * blanked here, so a removed element never keeps its links.
	 */
	private dropElement(element: SpatialElement<ItemT>): void {
		if (this.elements.enabled()) {
			this.elements.release(element);
		} else {
			element.cleanObj();
		}
	}

	private isPoint(point: unknown): point is SpatialPoint {
		if (typeof point !== 'object' || point === null) {
			return false;
		}

		const candidate = point as Partial<SpatialPoint>;

		return Number.isFinite(candidate.x) && Number.isFinite(candidate.y) && Number.isFinite(candidate.z);
	}

	private isBounds(bounds: unknown): bounds is SpatialBounds {
		if (typeof bounds !== 'object' || bounds === null) {
			return false;
		}

		const {minX, minY, minZ, maxX, maxY, maxZ} = bounds as Partial<SpatialBounds>;

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

	/** Whether value passes filters: every one of them, and at least one. */
	private queryMatch(filters: QueryFilter<ItemT> | QueryFilter<ItemT>[], value: ItemT): boolean {
		if (!Array.isArray(filters)) {
			return filters(value);
		}

		if (filters.length === 0) {
			return false;
		}

		for (let i = 0; i < filters.length; i++) {
			if (!filters[i](value)) {
				return false;
			}
		}

		return true;
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
