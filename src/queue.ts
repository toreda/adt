import {type DataStructure} from './data/structure';
import {type QueryFilter} from './query/filter';
import {type QueryOptions} from './query/options';
import {type QueryResult} from './query/result';
import {QueueIterator} from './queue/iterator';
import {type QueueMethod} from './queue/method';
import {type QueueOptions} from './queue/options';
import type {QueueState} from './queue/state';
import {isNumber} from './utility';

/** Smallest ring buffer a queue allocates. */
const MIN_CAPACITY = 16;

/** Shared `key()` for every query result. Queue items have no keys. */
const queryKeyNull = (): string | null => null;

/**
 * Unbounded FIFO queue. Items are added at the rear and removed from the front
 * in O(1). Every traversal (`forEach`, `filter`, `query`, iteration, `at`)
 * runs from the front to the rear, and position 0 is the front.
 *
 * Backed by a ring buffer that doubles when full and never shrinks. Once the
 * buffer has grown to the queue's peak size, `push`, `pop`, `peek`, `at`,
 * `forEach`, `clearElements`, and `reset` allocate nothing. `forEach` is the
 * non-allocating way to walk the queue; `for...of` allocates one iterator per
 * loop.
 *
 * Byte encoding is provided by the `ByteQueue` subclass, which requires an
 * `ItemCodec` at construction.
 *
 * @category Queue
 */
export class Queue<ItemT> implements DataStructure<ItemT> {
	/**
	 * Ring buffer. Its length is the current capacity. Slots outside the live
	 * range hold undefined.
	 */
	private _elements: Array<ItemT | undefined>;
	/** Ring buffer slot holding the front item. */
	private _front: number;
	private _size: number;

	/**
	 * @param options	Optional config. `elements` are copied into the queue
	 * 					front to rear. A missing or non-array `elements` gives an
	 * 					empty queue.
	 */
	constructor(options?: QueueOptions<ItemT> | null) {
		const elements = options?.elements;
		const count = Array.isArray(elements) ? elements.length : 0;

		let capacity = MIN_CAPACITY;
		while (capacity < count) {
			capacity *= 2;
		}

		this._elements = makeBuffer<ItemT>(capacity);
		this._front = 0;
		this._size = 0;

		if (Array.isArray(elements)) {
			for (let i = 0; i < elements.length; i++) {
				this.push(elements[i]);
			}
		}
	}

	/**
	 * Iterate items from front to rear.
	 */
	[Symbol.iterator](): QueueIterator<ItemT> {
		return new QueueIterator<ItemT>(this);
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
		if (this._size === 0) {
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
	 * Add an item at the rear. Allocates only when the ring buffer is full and
	 * has to double.
	 * @returns		This queue.
	 */
	public push(item: ItemT): Queue<ItemT> {
		if (this._size === this._elements.length) {
			this.grow();
		}

		this._elements[this.slot(this._size)] = item;
		this._size++;

		return this;
	}

	/**
	 * Get the front item without removing it.
	 * @returns		Front item, or null when the queue is empty.
	 */
	public front(): ItemT | null {
		if (this._size === 0) {
			return null;
		}

		return this._elements[this._front] as ItemT;
	}

	/**
	 * Get the item at position n. Like `Array.prototype.at` and
	 * `CircularQueue.getIndex`, 0 is the front and negative positions count
	 * back from the rear, so -1 is the rear.
	 * @returns		Item at position n, or null when n is not an integer or is
	 * 				outside the queue.
	 */
	public at(n: number): ItemT | null {
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
	 * Get the rear item without removing it.
	 * @returns		Rear item, or null when the queue is empty.
	 */
	public rear(): ItemT | null {
		if (this._size === 0) {
			return null;
		}

		return this._elements[this.slot(this._size - 1)] as ItemT;
	}

	/**
	 * Alias of rear().
	 */
	public back(): ItemT | null {
		return this.rear();
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

	/**
	 * Create a new queue containing only the items for which func returns
	 * true, in queue order.
	 * @param func		Called with (item, index, queue) from front to rear.
	 * @param thisArg	Value used as `this` when calling func. Defaults to this
	 * 					queue when omitted.
	 */
	public filter(func: QueueMethod<ItemT, boolean>, thisArg?: unknown): Queue<ItemT> {
		const result = new Queue<ItemT>();
		this.filterInto(result, func, thisArg);

		return result;
	}

	/**
	 * Push each item for which func returns true onto target, front to rear.
	 * Subclasses build their own `filter()` result with this.
	 */
	protected filterInto(target: Queue<ItemT>, func: QueueMethod<ItemT, boolean>, thisArg?: unknown): void {
		const boundThis = thisArg === undefined ? this : thisArg;

		for (let i = 0; i < this._size; i++) {
			const item = this._elements[this.slot(i)] as ItemT;

			if (func.call(boundThis, item, i, this)) {
				target.push(item);
			}
		}
	}

	/**
	 * Call func for each item, front to rear. Allocates nothing, so prefer it
	 * over `for...of` on a hot path.
	 *
	 * @remarks
	 * Like `Map` / `Set`, `CircularQueue`, and `LinkedList`, func receives the
	 * queue itself as its third argument, not an array: the queue has no
	 * backing array in front-to-rear order to hand out without copying. Items
	 * are visited by position, so adding or removing items during the walk
	 * shifts which items are visited.
	 *
	 * @param func		Called with (item, index, queue) from front to rear.
	 * @param thisArg	Value used as `this` when calling func. Defaults to this
	 * 					queue when omitted.
	 */
	public forEach(func: QueueMethod<ItemT, void>, thisArg?: unknown): Queue<ItemT> {
		const boundThis = thisArg === undefined ? this : thisArg;

		for (let i = 0; i < this._size; i++) {
			func.call(boundThis, this._elements[this.slot(i)] as ItemT, i, this);
		}

		return this;
	}

	/**
	 * Every item, front to rear, in a new array.
	 */
	public values(): ItemT[] {
		const values: ItemT[] = [];

		for (let i = 0; i < this._size; i++) {
			values.push(this._elements[this.slot(i)] as ItemT);
		}

		return values;
	}

	/**
	 * Reverse the order of queued items in place, so the rear becomes the
	 * front.
	 * @returns		This queue.
	 */
	public reverse(): Queue<ItemT> {
		for (let lo = 0, hi = this._size - 1; lo < hi; lo++, hi--) {
			const loSlot = this.slot(lo);
			const hiSlot = this.slot(hi);
			const tmp = this._elements[loSlot];
			this._elements[loSlot] = this._elements[hiSlot];
			this._elements[hiSlot] = tmp;
		}

		return this;
	}

	/**
	 * Serialize queue items, front to rear, to a JSON string shaped as
	 * `QueueState`.
	 * @returns		JSON string, or null when an item cannot be serialized
	 * 				(e.g. items contain circular references or BigInt values).
	 */
	public stringify(): string | null {
		const state: QueueState<ItemT> = {type: 'Queue', elements: this.values()};

		try {
			return JSON.stringify(state);
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
	 * Remove every item. The ring buffer is cleared in place and keeps its
	 * capacity, so refilling the queue allocates nothing.
	 */
	public clearElements(): Queue<ItemT> {
		// Slots outside the live range already hold undefined.
		for (let i = 0; i < this._size; i++) {
			this._elements[this.slot(i)] = undefined;
		}

		this._front = 0;
		this._size = 0;

		return this;
	}

	/**
	 * Restore the queue to an empty state. Same as `clearElements()`: the ring
	 * buffer keeps its capacity.
	 */
	public reset(): Queue<ItemT> {
		this.clearElements();

		return this;
	}

	/**
	 * Double the ring buffer, moving items to the start of the new buffer in
	 * front to rear order.
	 */
	private grow(): void {
		const next = makeBuffer<ItemT>(this._elements.length * 2);

		for (let i = 0; i < this._size; i++) {
			next[i] = this._elements[this.slot(i)];
		}

		this._elements = next;
		this._front = 0;
	}

	/**
	 * Ring buffer slot of the item at position from the front. Position is
	 * always within [0, capacity], so one conditional subtract replaces a
	 * modulo.
	 */
	private slot(position: number): number {
		const n = this._front + position;
		const capacity = this._elements.length;

		return n >= capacity ? n - capacity : n;
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

/**
 * Ring buffer of capacity undefined slots. Built with push rather than
 * `new Array(capacity)` so the array is packed, never holey.
 */
function makeBuffer<ItemT>(capacity: number): Array<ItemT | undefined> {
	const buffer: Array<ItemT | undefined> = [];

	for (let i = 0; i < capacity; i++) {
		buffer.push(undefined);
	}

	return buffer;
}
