import type {DataStructure} from '../data/structure.js';
import {booleanValue} from '../boolean/value.js';
import {CircularQueueIterator} from './queue/iterator.js';
import type {CircularQueueMethod} from './queue/method.js';
import type {CircularQueueOptions} from './queue/options.js';
import type {QueryFilter} from '../query/filter.js';
import type {QueryOptions} from '../query/options.js';
import type {QueryResult} from '../query/result.js';
import {isNumber} from '../utility.js';

/** Capacity used when `maxSize` is missing or invalid. */
const DEFAULT_MAX_SIZE = 25;

/**
 * Fixed capacity FIFO queue backed by a ring buffer. Items are added at the
 * rear and removed from the front in O(1).
 *
 * Every traversal (`forEach`, `filter`, `query`, iteration, `getIndex`) runs
 * from the front to the rear, and position 0 is the front. Positions are
 * logical: they never depend on where an item sits in the ring buffer.
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
	/** Ring buffer. Slots outside the live range hold undefined. */
	private _elements: Array<ItemT | undefined>;
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
		this._elements = [];
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
		this._front = this.wrap(this._front + 1);
		this._size--;

		return item;
	}

	/**
	 * Add items at the rear, in argument order. When the queue is full, each
	 * further item overwrites the front item if `overwrite` is on, and is not
	 * added otherwise.
	 * @returns		True when every item was added. False when the queue filled
	 * 				up with overwrite off; items before that point were added.
	 */
	public push(...items: ItemT[]): boolean {
		return this.pushArray(items);
	}

	/**
	 * Add each item of an array at the rear, as `push()` does. Unlike spreading
	 * an array into `push()`, works for arrays of any length.
	 * @returns		True when every item was added, false when one was not or
	 * 				when items is not an array.
	 */
	public pushArray(items?: ItemT[] | null): boolean {
		if (!Array.isArray(items)) {
			return false;
		}

		for (const item of items) {
			if (!this.pushOne(item)) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Add items at the front, one at a time in argument order, so the last
	 * argument ends up in front. When the queue is full, each further item
	 * overwrites the rear item if `overwrite` is on, and is not added otherwise.
	 * @returns		True when every item was added. False when the queue filled
	 * 				up with overwrite off; items before that point were added.
	 */
	public insertFront(...items: ItemT[]): boolean {
		for (const item of items) {
			if (this.isFull()) {
				if (!this.overwrite) {
					return false;
				}

				// Full, so the slot before the front is the rear slot.
				this._front = this.wrap(this._front - 1);
				this._elements[this._front] = item;
				continue;
			}

			this._front = this.wrap(this._front - 1);
			this._elements[this._front] = item;
			this._size++;
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

		this.forEach((item, index, queue) => {
			if (func.call(thisArg, item, index, queue)) {
				values.push(item);
			}
		});

		return values;
	}

	/**
	 * Options equivalent to the ones this queue was built with, for creating
	 * derived queues that behave the same way.
	 */
	protected options(): CircularQueueOptions<ItemT> {
		return {maxSize: this.maxSize, overwrite: this.overwrite};
	}

	/**
	 * Call func for each item, front to rear.
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
		const options = this.queryOptions(opts);

		// Stops walking as soon as the limit is reached.
		for (let i = 0; i < this._size && resultsArray.length < options.limit; i++) {
			const item = this._elements[this.slot(i)] as ItemT;
			const take = Array.isArray(filters)
				? filters.length > 0 && filters.every((filter) => filter(item))
				: filters(item);

			if (!take) {
				continue;
			}

			resultsArray.push({
				element: item,
				key: (): string | null => null,
				index: this.indexOf.bind(this, item),
				delete: this.queryDelete.bind(this, item)
			});
		}

		return resultsArray;
	}

	/**
	 * Remove every item. Options are kept.
	 */
	public clearElements(): CircularQueue<ItemT> {
		this._elements = [];
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

	private pushOne(item: ItemT): boolean {
		if (this.isFull()) {
			if (!this.overwrite) {
				return false;
			}

			// Full, so the slot after the rear is the front slot: overwrite the
			// front item and move the front forward.
			this._elements[this._front] = item;
			this._front = this.wrap(this._front + 1);
			return true;
		}

		this._elements[this.slot(this._size)] = item;
		this._size++;

		return true;
	}

	/**
	 * Ring buffer slot of the item at position from the front.
	 */
	private slot(position: number): number {
		return this.wrap(this._front + position);
	}

	private wrap(n: number): number {
		return ((n % this.maxSize) + this.maxSize) % this.maxSize;
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
