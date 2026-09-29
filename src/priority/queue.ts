import {type DataStructure} from '../data/structure';
import {type PriorityQueueComparator as Comparator} from './queue/comparator';
import {type PriorityQueueMethod} from './queue/method';
import {type PriorityQueueOptions as Options} from './queue/options';
import {type QueryFilter} from '../query/filter';
import {type QueryOptions} from '../query/options';
import {type QueryResult} from '../query/result';
import type {PriorityQueueState as State} from './queue/state';
import {isNumber} from '../utility';

/** Shared `key()` for every query result. Heap elements have no key. */
const queryKey = (): string | null => null;

/**
 * Heap data structure which operates as a Min Heap or Max Heap
 * depending on user provided Comparator Function provided.
 *
 * The comparator returns true when `a` must be closer to the front than `b`.
 * Elements only move when one strictly beats the other, so equal priorities
 * stay where they are. Every element, including `null`, is passed to the
 * comparator, so a queue that holds `null` needs a comparator that handles it.
 *
 * Push, pop, and query deletes allocate nothing. The backing array never
 * shrinks: it stays at the largest size the queue has reached and a separate
 * count tracks the live elements, so a queue that fills and drains every frame
 * keeps reusing the same storage. Vacated slots are set to `undefined`, so
 * popped elements can still be garbage collected.
 *
 * Byte encoding is provided by the `BytePriorityQueue` subclass, which
 * requires an `ItemCodec` at construction.
 *
 * @category Priority Queue
 */
export class PriorityQueue<ItemT> implements DataStructure<ItemT> {
	/**
	 * Backing array in heap order. Its length is the high-water mark: only
	 * slots below `_size` hold live elements, the rest hold `undefined`.
	 */
	private readonly _elements: (ItemT | undefined)[];
	/** Number of live elements. */
	private _size: number;
	protected readonly comparator: Comparator<ItemT>;

	/**
	 * @param comparator	Returns true when `a` must be closer to the front than `b`.
	 * 						Required.
	 * @param options		Optional config. `elements` are heapified on creation.
	 * @throws				When `comparator` is not a function, or when
	 * 						`options.elements` is present but not an array.
	 */
	constructor(comparator: Comparator<ItemT>, options?: Options<ItemT>) {
		if (typeof comparator !== 'function') {
			throw new Error('Must have a comparator function for priority queue to operate properly');
		}

		this.comparator = comparator;

		this._elements = this.parseOptions(options);
		this._size = this._elements.length;
		this.heapify();
	}

	public peek(): ItemT | null {
		if (this._size === 0) {
			return null;
		}

		return this._elements[0] as ItemT;
	}

	/**
	 * Remove and return the highest priority element. Keeps the backing
	 * array's length.
	 * @returns		Removed element or null when the queue is empty.
	 */
	public pop(): ItemT | null {
		if (this._size === 0) {
			return null;
		}

		const elements = this._elements;
		const highestPriority = elements[0] as ItemT;
		const lastIndex = --this._size;
		const last = elements[lastIndex] as ItemT;
		// Drop the reference but keep the slot, so the capacity is kept.
		elements[lastIndex] = undefined;

		if (lastIndex > 0) {
			elements[0] = last;
			this.siftDown(0);
		}

		return highestPriority;
	}

	public push(element: ItemT): PriorityQueue<ItemT> {
		// Reuses a spare slot when there is one; grows the array otherwise.
		const index = this._size++;
		this._elements[index] = element;
		this.siftUp(index);

		return this;
	}

	/**
	 * Restore heap order over every element. O(n). Does nothing when the
	 * elements already form a heap.
	 */
	public heapify(): void {
		if (this.isHeap()) {
			return;
		}

		for (let node = this.getParent(this._size - 1); node >= 0; node--) {
			this.siftDown(node);
		}
	}

	/**
	 * Get number of elements currently in Priority Queue.
	 */
	public size(): number {
		return this._size;
	}

	/**
	 * Check if priority queue has elements.
	 */
	public isEmpty(): boolean {
		return this._size === 0;
	}

	/**
	 * Every element in heap array order (not priority order), in a new array.
	 * Allocates only the returned array.
	 */
	public values(): ItemT[] {
		const values: ItemT[] = [];

		for (let i = 0; i < this._size; i++) {
			values.push(this._elements[i] as ItemT);
		}

		return values;
	}

	/**
	 * Create a new priority queue with the same comparator, holding the
	 * elements for which func returns true.
	 * @param func		Called with (element, index, queue) in heap array order, where
	 * 					queue is this queue. Don't push, pop, or delete from it
	 * 					inside func.
	 * @param thisArg	Value used as `this` when calling func. Defaults to this queue.
	 */
	public filter(func: PriorityQueueMethod<ItemT, boolean>, thisArg?: unknown): PriorityQueue<ItemT> {
		return this.filterInto(new PriorityQueue<ItemT>(this.comparator), func, thisArg);
	}

	/**
	 * Fill `target`, which must be empty, with the elements for which func
	 * returns true, then heapify it. Allocates only the target's array.
	 * Subclasses build their own `filter()` result with this.
	 */
	protected filterInto<Q extends PriorityQueue<ItemT>>(
		target: Q,
		func: PriorityQueueMethod<ItemT, boolean>,
		thisArg?: unknown
	): Q {
		const boundThis = thisArg === undefined ? this : thisArg;
		const elements = this._elements as ItemT[];
		const out = target._elements;
		let count = 0;

		for (let i = 0; i < this._size; i++) {
			const element = elements[i];

			if (func.call(boundThis, element, i, this)) {
				out[count++] = element;
			}
		}

		target._size = count;
		target.heapify();

		return target;
	}

	/**
	 * Call func once for each element in heap array order (not priority order).
	 * Allocates nothing.
	 * @param func		Called with (element, index, queue) where queue is this
	 * 					queue. Don't push, pop, or delete from it inside func.
	 * @param thisArg	Value used as `this` when calling func. Defaults to this queue.
	 */
	public forEach(func: PriorityQueueMethod<ItemT, void>, thisArg?: unknown): PriorityQueue<ItemT> {
		const boundThis = thisArg === undefined ? this : thisArg;
		const elements = this._elements as ItemT[];

		for (let i = 0; i < this._size; i++) {
			func.call(boundThis, elements[i], i, this);
		}

		return this;
	}

	/**
	 * Serialize the queue to a JSON string shaped as `PriorityQueueState`,
	 * elements in heap array order.
	 * @returns		JSON string, or null when the state cannot be serialized
	 * 				(e.g. elements contain circular references or BigInt values).
	 */
	public stringify(): string | null {
		const state: State<ItemT> = {type: 'PriorityQueue', elements: this.values()};

		try {
			return JSON.stringify(state);
		} catch {
			return null;
		}
	}

	/**
	 * Find elements that pass every filter, in heap array order, stopping once
	 * `limit` results are found. An empty filter array matches nothing.
	 */
	public query(
		filters: QueryFilter<ItemT> | QueryFilter<ItemT>[],
		opts?: QueryOptions
	): QueryResult<ItemT>[] {
		const resultsArray: QueryResult<ItemT>[] = [];
		const limit = this.queryLimit(opts);
		const elements = this._elements;
		const isArray = Array.isArray(filters);

		for (let i = 0; i < this._size && resultsArray.length < limit; i++) {
			const element = elements[i] as ItemT;
			let take: boolean;

			if (isArray) {
				take = filters.length > 0;

				for (let f = 0; take && f < filters.length; f++) {
					take = filters[f](element);
				}
			} else {
				take = filters(element);
			}

			if (!take) {
				continue;
			}

			resultsArray.push({
				element,
				key: queryKey,
				index: this.queryIndex.bind(this, element),
				delete: this.queryDelete.bind(this, element)
			});
		}

		return resultsArray;
	}

	/**
	 * Remove every element. Clears the slots in place and keeps the backing
	 * array at its length, so refilling the queue reuses its capacity.
	 */
	public clearElements(): PriorityQueue<ItemT> {
		this._elements.fill(undefined, 0, this._size);
		this._size = 0;

		return this;
	}

	/**
	 * Same as `clearElements()`. The comparator is kept.
	 */
	public reset(): PriorityQueue<ItemT> {
		return this.clearElements();
	}

	/**
	 * True when `a` must be strictly closer to the front than `b`, so an
	 * element only moves past another when it strictly beats it.
	 */
	private beats(a: ItemT, b: ItemT): boolean {
		return this.comparator(a, b);
	}

	/**
	 * Move the element at `node` toward the root while it strictly beats its parent.
	 */
	private siftUp(nodeArg: number): void {
		const elements = this._elements as ItemT[];
		let node = nodeArg;
		const value = elements[node];

		while (node > 0) {
			const parent = (node - 1) >> 1;

			if (!this.beats(value, elements[parent])) {
				break;
			}

			elements[node] = elements[parent];
			node = parent;
		}

		elements[node] = value;
	}

	/**
	 * Move the element at `node` toward the leaves while a child strictly beats it.
	 * Only live slots (below `_size`) are considered.
	 */
	private siftDown(nodeArg: number): void {
		const elements = this._elements as ItemT[];
		const size = this._size;
		let node = nodeArg;
		const value = elements[node];

		for (;;) {
			const left = 2 * node + 1;

			if (left >= size) {
				break;
			}

			const right = left + 1;
			let best = left;

			if (right < size && this.beats(elements[right], elements[left])) {
				best = right;
			}

			if (!this.beats(elements[best], value)) {
				break;
			}

			elements[node] = elements[best];
			node = best;
		}

		elements[node] = value;
	}

	private getParent(node: number): number {
		if (node < 1) {
			return -1;
		}

		return (node - 1) >> 1;
	}

	/**
	 * True when no live element strictly beats its parent. Equal priorities pass.
	 */
	private isHeap(): boolean {
		const elements = this._elements as ItemT[];

		for (let node = 1; node < this._size; node++) {
			if (this.beats(elements[node], elements[(node - 1) >> 1])) {
				return false;
			}
		}

		return true;
	}

	private parseOptions(options?: Options<ItemT>): ItemT[] {
		if (options?.elements == null) {
			return [];
		}

		if (!Array.isArray(options.elements)) {
			throw [Error('state elements must be an array')];
		}

		return options.elements.slice();
	}

	private queryDelete(element: ItemT): ItemT | null {
		const index = this.queryIndex(element);

		if (index === null) {
			return null;
		}

		const elements = this._elements as ItemT[];
		const lastIndex = --this._size;
		const last = elements[lastIndex];
		// Drop the reference but keep the slot, so the capacity is kept.
		this._elements[lastIndex] = undefined;

		if (index < lastIndex) {
			// The element moved in from the end may belong above or below
			// this position, so sift in whichever direction it needs.
			elements[index] = last;

			if (index > 0 && this.beats(last, elements[(index - 1) >> 1])) {
				this.siftUp(index);
			} else {
				this.siftDown(index);
			}
		}

		return element;
	}

	private queryIndex(element: ItemT): number | null {
		// Only live slots are searched; spare slots hold undefined.
		const elements = this._elements;

		for (let i = 0; i < this._size; i++) {
			if (elements[i] === element) {
				return i;
			}
		}

		return null;
	}

	private queryLimit(opts?: QueryOptions): number {
		const limit = opts?.limit;

		if (limit && isNumber(limit) && limit >= 1) {
			return Math.round(limit);
		}

		return Infinity;
	}
}
