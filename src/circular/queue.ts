import type {DataStructure} from '../data/structure';
import {booleanValue} from '../boolean/value';
import {CircularQueueIterator} from './queue/iterator';
import type {CircularQueueMethod} from './queue/method';
import type {CircularQueueOptions} from './queue/options';
import type {QueryFilter} from '../query/filter';
import type {QueryOptions} from '../query/options';
import type {QueryResult} from '../query/result';
import {isNumber, undefinedItemSkip} from '../utility';

/** Capacity used when `maxSize` is missing or invalid. */
const DEFAULT_MAX_SIZE = 25;

/** Shared `key()` for every query result. Queue items have no keys. */
const queryKeyNull = (): string | null => null;

/**
 * Fixed capacity FIFO queue backed by a ring buffer. Items are added at the
 * rear and removed from the front in O(1).
 *
 * Every traversal (`forEach`, `filter`, `query`, iteration, `getIndex`) runs
 * from the front to the rear, and position 0 is the front. Positions are
 * logical: they never depend on where an item sits in the ring buffer.
 *
 * The ring buffer holds `maxSize` slots, allocated once at construction and
 * reused for the queue's lifetime: `push`, `pop`, `insertFront`, `peek`,
 * `getIndex`, `forEach`, `clearElements`, and `reset` never allocate.
 * `forEach` is the non-allocating way to walk the queue; `for...of` allocates
 * one iterator per loop.
 *
 * Byte encoding is provided by the `ByteCircularQueue` subclass, which requires
 * an `ItemCodec` at construction.
 *
 * @category Circular Queue
 */
export class CircularQueue<ItemT> implements DataStructure<ItemT> {
	/** Capacity of the queue. Fixed at construction. */
	public readonly maxSize: number;
	/** Whether adding to a full queue overwrites instead of failing. */
	public readonly overwrite: boolean;
	/** Whether an undefined item is skipped as a no-op or throws. */
	public readonly allowUndefinedItem: boolean;
	/**
	 * Ring buffer of exactly `maxSize` slots, allocated once. Slots outside the
	 * live range hold undefined.
	 */
	private readonly _elements: Array<ItemT | undefined>;
	/** Ring buffer slot holding the front item. */
	private _front: number;
	private _size: number;

	/**
	 * @param data		Items pushed front to rear on creation. When there are
	 * 					more than `maxSize`, the extras are dropped, or with
	 * 					`overwrite` the last `maxSize` items are kept. Any other
	 * 					input is ignored.
	 * @param options	Optional config. Each option falls back to its default
	 * 					when missing or invalid.
	 */
	constructor(data?: ItemT[] | null, options?: CircularQueueOptions<ItemT> | null) {
		const maxSize = options?.maxSize;
		this.maxSize =
			Number.isInteger(maxSize) && (maxSize as number) >= 1 ? (maxSize as number) : DEFAULT_MAX_SIZE;
		this.overwrite = booleanValue(false, options?.overwrite);
		this.allowUndefinedItem = booleanValue(true, options?.allowUndefinedItem);
		// Filled with push rather than `new Array(maxSize)` so the array is
		// packed from the start and never holey, whichever slot is written first.
		this._elements = [];
		for (let i = 0; i < this.maxSize; i++) {
			this._elements.push(undefined);
		}
		this._front = 0;
		this._size = 0;

		if (Array.isArray(data)) {
			this.pushArray(data);
		}
	}

	/**
	 * Iterate items from front to rear.
	 */
	[Symbol.iterator](): CircularQueueIterator<ItemT> {
		return new CircularQueueIterator<ItemT>(this);
	}

	/**
	 * Alias of front(). Get the front item without removing it.
	 * @returns		Front item, or null when the queue is empty.
	 */
	public peek(): ItemT | null {
		return this.front();
	}

	/**
	 * Remove and return the front item.
	 * @returns		Removed item, or null when the queue is empty.
	 */
	public pop(): ItemT | null {
		if (this.isEmpty()) {
			return null;
		}

		const item = this._elements[this._front] as ItemT;
		// Drop the reference so a popped item can be garbage collected.
		this._elements[this._front] = undefined;
		this._front = this.slot(1);
		this._size--;

		return item;
	}

	/**
	 * Add one item at the rear. When the queue is full, the item overwrites the
	 * front item if `overwrite` is on, and is not added otherwise.
	 *
	 * @remarks
	 * Takes exactly one item so a call never builds a rest-parameter array.
	 * Use `pushArray()` to add several.
	 * @returns		True when the item was added, false when the queue is full
	 * 				and `overwrite` is off, or when item is undefined (skipped
	 * 				as a no-op; throws when `allowUndefinedItem` is `false`).
	 */
	public push(item: ItemT): boolean {
		if (undefinedItemSkip(item, this.allowUndefinedItem, 'CircularQueue')) {
			return false;
		}

		if (this._size >= this.maxSize) {
			if (!this.overwrite) {
				return false;
			}

			// Full, so the slot after the rear is the front slot: overwrite the
			// front item and move the front forward.
			this._elements[this._front] = item;
			this._front = this.slot(1);
			return true;
		}

		this._elements[this.slot(this._size)] = item;
		this._size++;

		return true;
	}

	/**
	 * Add each item of an array at the rear, in array order, as `push()` does.
	 * Works for arrays of any length. Undefined items are skipped without
	 * ending the walk (or throw, when `allowUndefinedItem` is `false`).
	 * @returns		True when every item was added. False when the queue filled
	 * 				up with overwrite off (items before that point were added),
	 * 				or when items is not an array.
	 */
	public pushArray(items?: ItemT[] | null): boolean {
		if (!Array.isArray(items)) {
			return false;
		}

		for (let i = 0; i < items.length; i++) {
			if (undefinedItemSkip(items[i], this.allowUndefinedItem, 'CircularQueue')) {
				continue;
			}

			if (!this.push(items[i])) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Add one item at the front. When the queue is full, the item overwrites
	 * the rear item if `overwrite` is on, and is not added otherwise.
	 *
	 * @remarks
	 * Takes exactly one item so a call never builds a rest-parameter array.
	 * Use `insertFrontArray()` to add several.
	 * @returns		True when the item was added, false when the queue is full
	 * 				and `overwrite` is off, or when item is undefined (skipped
	 * 				as a no-op; throws when `allowUndefinedItem` is `false`).
	 */
	public insertFront(item: ItemT): boolean {
		if (undefinedItemSkip(item, this.allowUndefinedItem, 'CircularQueue')) {
			return false;
		}

		if (this._size >= this.maxSize) {
			if (!this.overwrite) {
				return false;
			}

			// Full, so the slot before the front is the rear slot.
			this._front = this.slot(-1);
			this._elements[this._front] = item;
			return true;
		}

		this._front = this.slot(-1);
		this._elements[this._front] = item;
		this._size++;

		return true;
	}

	/**
	 * Add each item of an array at the front, one at a time in array order, as
	 * `insertFront()` does, so the last item ends up in front. Undefined items
	 * are skipped without ending the walk (or throw, when `allowUndefinedItem`
	 * is `false`).
	 * @returns		True when every item was added. False when the queue filled
	 * 				up with overwrite off (items before that point were added),
	 * 				or when items is not an array.
	 */
	public insertFrontArray(items?: ItemT[] | null): boolean {
		if (!Array.isArray(items)) {
			return false;
		}

		for (let i = 0; i < items.length; i++) {
			if (undefinedItemSkip(items[i], this.allowUndefinedItem, 'CircularQueue')) {
				continue;
			}

			if (!this.insertFront(items[i])) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Get the front item without removing it.
	 * @returns		Front item, or null when the queue is empty.
	 */
	public front(): ItemT | null {
		if (this.isEmpty()) {
			return null;
		}

		return this._elements[this._front] as ItemT;
	}

	/**
	 * Get the rear item without removing it.
	 * @returns		Rear item, or null when the queue is empty.
	 */
	public rear(): ItemT | null {
		if (this.isEmpty()) {
			return null;
		}

		return this._elements[this.slot(this._size - 1)] as ItemT;
	}

	/**
	 * Get the item at position n. Like `Array.prototype.at`, 0 is the front
	 * and negative positions count back from the rear, so -1 is the rear.
	 * @returns		Item at position n, or null when n is not an integer or is
	 * 				outside the queue.
	 */
	public getIndex(n: number): ItemT | null {
		if (!Number.isInteger(n)) {
			return null;
		}

		const position = n < 0 ? n + this._size : n;

		if (position < 0 || position >= this._size) {
			return null;
		}

		return this._elements[this.slot(position)] as ItemT;
	}

	/**
	 * Get number of items in the queue.
	 */
	public size(): number {
		return this._size;
	}

	public isEmpty(): boolean {
		return this._size === 0;
	}

	public isFull(): boolean {
		return this._size >= this.maxSize;
	}

	/**
	 * Create a new queue containing only the items for which func returns
	 * true, in queue order. The new queue uses this queue's options.
	 * @param func		Called with (item, index, queue) from front to rear.
	 * @param thisArg	Value used as `this` when calling func, as passed. Like
	 * 					`Array.prototype.filter`, `this` is undefined when omitted.
	 */
	public filter(func: CircularQueueMethod<ItemT, boolean>, thisArg?: unknown): CircularQueue<ItemT> {
		return new CircularQueue<ItemT>(this.filterValues(func, thisArg), this.options());
	}

	/**
	 * Items for which func returns true, front to rear. Subclasses build their
	 * own `filter()` result from this.
	 */
	protected filterValues(func: CircularQueueMethod<ItemT, boolean>, thisArg?: unknown): ItemT[] {
		const values: ItemT[] = [];

		for (let i = 0; i < this._size; i++) {
			const item = this._elements[this.slot(i)] as ItemT;

			if (func.call(thisArg, item, i, this)) {
				values.push(item);
			}
		}

		return values;
	}

	/**
	 * Options equivalent to the ones this queue was built with, for creating
	 * derived queues that behave the same way.
	 */
	protected options(): CircularQueueOptions<ItemT> {
		return {
			maxSize: this.maxSize,
			overwrite: this.overwrite,
			allowUndefinedItem: this.allowUndefinedItem
		};
	}

	/**
	 * Call func for each item, front to rear. Allocates nothing, so prefer it
	 * over `for...of` on a hot path.
	 *
	 * @remarks
	 * Like `Map` / `Set`, func receives the queue itself as its third argument,
	 * not an array. Items are visited by position, so adding or removing items
	 * during the walk shifts which items are visited.
	 *
	 * @param func		Called with (item, index, queue) from front to rear.
	 * @param thisArg	Value used as `this` when calling func, as passed. Like
	 * 					`Array.prototype.forEach`, `this` is undefined when omitted.
	 */
	public forEach(func: CircularQueueMethod<ItemT, void>, thisArg?: unknown): CircularQueue<ItemT> {
		for (let i = 0; i < this._size; i++) {
			func.call(thisArg, this._elements[this.slot(i)] as ItemT, i, this);
		}

		return this;
	}

	/**
	 * Every item, front to rear.
	 */
	public values(): ItemT[] {
		const values: ItemT[] = [];

		for (let i = 0; i < this._size; i++) {
			values.push(this._elements[this.slot(i)] as ItemT);
		}

		return values;
	}

	/**
	 * Serialize queue items, front to rear, to a JSON string.
	 * @returns		JSON string, or null when an item cannot be serialized
	 * 				(e.g. items contain circular references or BigInt values).
	 */
	public stringify(): string | null {
		try {
			return JSON.stringify({type: 'CircularQueue', elements: this.values()});
		} catch {
			return null;
		}
	}

	/**
	 * Find items that pass every filter, front to rear. Each result's `index()`
	 * is the item's current position from the front, found when called. Its
	 * `delete()` removes the item and closes the gap, keeping queue order.
	 *
	 * @remarks
	 * Results find their item again by identity when `index()` or `delete()`
	 * runs. When the same value is queued more than once, they act on the
	 * first occurrence from the front.
	 */
	public query(
		filters: QueryFilter<ItemT> | QueryFilter<ItemT>[],
		opts?: QueryOptions
	): QueryResult<ItemT>[] {
		const resultsArray: QueryResult<ItemT>[] = [];
		const limit = this.queryLimit(opts);
		const many = Array.isArray(filters);

		// An empty filter array matches nothing.
		if (many && filters.length === 0) {
			return resultsArray;
		}

		// Stops walking as soon as the limit is reached.
		for (let i = 0; i < this._size && resultsArray.length < limit; i++) {
			const item = this._elements[this.slot(i)] as ItemT;
			let take = true;

			if (many) {
				for (let f = 0; f < filters.length; f++) {
					if (!filters[f](item)) {
						take = false;
						break;
					}
				}
			} else {
				take = filters(item);
			}

			if (!take) {
				continue;
			}

			resultsArray.push({
				element: item,
				key: queryKeyNull,
				index: this.indexOf.bind(this, item),
				delete: this.queryDelete.bind(this, item)
			});
		}

		return resultsArray;
	}

	/**
	 * Remove every item. Options are kept. The ring buffer is cleared in place
	 * and reused, so refilling the queue allocates nothing.
	 */
	public clearElements(): CircularQueue<ItemT> {
		// Slots outside the live range already hold undefined.
		for (let i = 0; i < this._size; i++) {
			this._elements[this.slot(i)] = undefined;
		}

		this._front = 0;
		this._size = 0;

		return this;
	}

	/**
	 * Restore the queue to its freshly constructed, empty state. Options are
	 * kept.
	 */
	public reset(): CircularQueue<ItemT> {
		this.clearElements();

		return this;
	}

	/**
	 * Ring buffer slot of the item at position from the front. Position is
	 * always within [-1, maxSize], so the front plus position lies within
	 * [-1, 2 * maxSize) and one conditional add or subtract replaces a modulo.
	 */
	private slot(position: number): number {
		const n = this._front + position;

		if (n >= this.maxSize) {
			return n - this.maxSize;
		}

		if (n < 0) {
			return n + this.maxSize;
		}

		return n;
	}

	/**
	 * Position from the front of the first item identical to item.
	 * @returns		Position, or null when item is not in the queue.
	 */
	private indexOf(item: ItemT): number | null {
		for (let i = 0; i < this._size; i++) {
			if (this._elements[this.slot(i)] === item) {
				return i;
			}
		}

		return null;
	}

	/**
	 * Remove the first item identical to item, shifting every later item one
	 * position toward the front so queue order is kept.
	 * @returns		The removed item, or null when it is no longer queued.
	 */
	private queryDelete(item: ItemT): ItemT | null {
		const position = this.indexOf(item);

		if (position === null) {
			return null;
		}

		for (let i = position; i < this._size - 1; i++) {
			this._elements[this.slot(i)] = this._elements[this.slot(i + 1)];
		}

		this._elements[this.slot(this._size - 1)] = undefined;
		this._size--;

		return item;
	}

	/**
	 * Maximum number of query results: `opts.limit` rounded, when it is a
	 * number of at least 1, otherwise unlimited.
	 */
	private queryLimit(opts?: QueryOptions): number {
		const limit = opts?.limit;

		if (limit && isNumber(limit) && limit >= 1) {
			return Math.round(limit);
		}

		return Infinity;
	}
}
