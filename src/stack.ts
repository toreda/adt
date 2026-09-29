import type {DataStructure} from './data/structure';
import type {StackMethod} from './stack/method';
import type {StackOptions as Options} from './stack/options';
import type {QueryFilter} from './query/filter';
import {type QueryOptions} from './query/options';
import type {QueryResult} from './query/result';
import {StackIterator} from './stack/iterator';
import type {StackState as State} from './stack/state';
import {isNumber} from './utility';

/** Shared `key()` for every query result. Stack elements have no key. */
const queryKey = (): string | null => null;

/**
 * Stack data structure with standard FILO functionality.
 *
 * Every traversal (`forEach`, `filter`, `query`, iteration, `at`) runs from
 * the top to the bottom, and position 0 is the top.
 *
 * The backing array never shrinks. It stays at the largest size the stack has
 * reached and a separate count tracks the live elements, so a stack that fills
 * and drains every frame keeps reusing the same storage. Vacated slots are set
 * to `undefined`, so popped elements can still be garbage collected.
 *
 * Byte encoding is provided by the `ByteStack` subclass, which requires an
 * `ItemCodec` at construction.
 *
 * @category Stack
 */
export class Stack<T> implements DataStructure<T> {
	/**
	 * Backing array, bottom first. Its length is the high-water mark: only
	 * slots below `_size` hold live elements, the rest hold `undefined`.
	 */
	private readonly _elements: (T | undefined)[];
	/** Number of live elements. */
	private _size: number;

	/**
	 * @param options	Optional config. `elements` are pushed bottom to top, so
	 * 					the last one becomes the top.
	 * @throws			When `options.elements` is present but not an array.
	 */
	constructor(options?: Options<T>) {
		this._elements = this.parseOptions(options);
		this._size = this._elements.length;
	}

	/**
	 * Snapshot of the stack as `StackState`, with `elements` bottom to top.
	 *
	 * @remarks
	 * Builds a new object and array on every read, and is not linked to the
	 * stack: changing it does not change the stack. Prefer `values()`,
	 * `forEach`, or `at()`.
	 */
	public get state(): State<T> {
		const elements: T[] = [];

		for (let i = 0; i < this._size; i++) {
			elements.push(this._elements[i] as T);
		}

		return {type: 'Stack', elements};
	}

	/**
	 * Iterate elements from top to bottom. The iterator reuses one result
	 * object; `forEach` is the allocation-free way to walk the stack.
	 */
	[Symbol.iterator](): StackIterator<T> {
		return new StackIterator<T>(this);
	}

	/**
	 * Alias of top(). Get the top element without removing it.
	 * @returns		Top element or null when stack is empty.
	 */
	public peek(): T | null {
		return this.top();
	}

	/**
	 * Remove and return the top element. Keeps the backing array's length.
	 * @returns		Removed element or null when stack is empty.
	 */
	public pop(): T | null {
		if (this._size === 0) {
			return null;
		}

		const index = --this._size;
		const element = this._elements[index] as T;
		// Drop the reference but keep the slot, so the capacity is kept.
		this._elements[index] = undefined;

		return element;
	}

	public push(element: T): Stack<T> {
		// Reuses a spare slot when there is one; grows the array otherwise.
		this._elements[this._size++] = element;

		return this;
	}

	public top(): T | null {
		if (this._size === 0) {
			return null;
		}

		return this._elements[this._size - 1] as T;
	}

	public bottom(): T | null {
		if (this._size === 0) {
			return null;
		}

		return this._elements[0] as T;
	}

	/**
	 * Get the Nth element down from the top of the stack. Position 0 is the top,
	 * matching forEach's index and the index reported by query results.
	 * @param n		Position to retrieve. Must be a non-negative integer.
	 * @returns		Element at position n, or null when n is not a valid position.
	 */
	public at(n: number): T | null {
		const size = this._size;

		if (!Number.isInteger(n) || n < 0 || n >= size) {
			return null;
		}

		return this._elements[size - 1 - n] as T;
	}

	public size(): number {
		return this._size;
	}

	public isEmpty(): boolean {
		return this._size === 0;
	}

	/**
	 * Every element, top to bottom, in a new array. Allocates only the
	 * returned array.
	 */
	public values(): T[] {
		const values: T[] = [];

		for (let i = this._size - 1; i >= 0; i--) {
			values.push(this._elements[i] as T);
		}

		return values;
	}

	/**
	 * Create a new stack containing only elements for which func returns true.
	 * Elements are visited top to bottom and keep their relative order in the new stack.
	 * @param func		Called with (element, index, stack) where index 0 is the top of the
	 * 					stack and stack is this stack.
	 * @param thisArg	Value used as `this` when calling func. Defaults to this stack.
	 * @returns			New stack containing the matching elements.
	 */
	public filter(func: StackMethod<T, boolean>, thisArg?: unknown): Stack<T> {
		return this.filterInto(new Stack<T>(), func, thisArg);
	}

	/**
	 * Fill `target`, which must be empty, with the elements for which func
	 * returns true, keeping their order. Allocates only the target's array.
	 * Subclasses build their own `filter()` result with this.
	 */
	protected filterInto<S extends Stack<T>>(target: S, func: StackMethod<T, boolean>, thisArg?: unknown): S {
		const boundThis = thisArg === undefined ? this : thisArg;
		const elements = this._elements;
		const out = target._elements;
		let count = 0;

		// Visit top first, then reverse the result in place so the new
		// stack's array is bottom-first like this stack's.
		for (let i = this._size - 1, idx = 0; i >= 0; i--, idx++) {
			const element = elements[i] as T;

			if (func.call(boundThis, element, idx, this)) {
				out[count++] = element;
			}
		}

		target._size = count;
		target.reverseLive();

		return target;
	}

	/**
	 * Call func once for each element, visiting elements from top to bottom.
	 * Allocates nothing, so it is the preferred way to walk the stack on a hot path.
	 *
	 * @remarks
	 * Like `Map` / `Set` (and `LinkedList`, `CircularQueue`), func receives the
	 * stack itself as its third argument, not an array. Use `at(index)` for
	 * positional access. Pushing or popping during the walk is not supported.
	 *
	 * @param func		Called with (element, index, stack) where index 0 is the top of the stack.
	 * @param thisArg	Value used as `this` when calling func. Defaults to this stack.
	 * @returns			This stack.
	 */
	public forEach(func: StackMethod<T, void>, thisArg?: unknown): Stack<T> {
		const boundThis = thisArg === undefined ? this : thisArg;
		const elements = this._elements;

		for (let i = this._size - 1, idx = 0; i >= 0; i--, idx++) {
			func.call(boundThis, elements[i] as T, idx, this);
		}

		return this;
	}

	public reverse(): Stack<T> {
		this.reverseLive();

		return this;
	}

	/**
	 * Serialize the stack to a JSON string shaped as `StackState`, elements
	 * bottom to top.
	 * @returns		JSON string, or null when the state cannot be serialized
	 * 				(e.g. elements contain circular references or BigInt values).
	 */
	public stringify(): string | null {
		const state = this.state;

		try {
			return JSON.stringify(state);
		} catch {
			return null;
		}
	}

	/**
	 * Find elements that pass every filter, top to bottom, stopping once
	 * `limit` results are found. An empty filter array matches nothing.
	 */
	public query(filters: QueryFilter<T> | QueryFilter<T>[], opts?: QueryOptions): QueryResult<T>[] {
		const resultsArray: QueryResult<T>[] = [];
		const limit = this.queryLimit(opts);
		const elements = this._elements;
		const isArray = Array.isArray(filters);

		// Visit top to bottom, stopping once the limit is reached.
		for (let i = this._size - 1; i >= 0 && resultsArray.length < limit; i--) {
			const element = elements[i] as T;
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

			// Track the array position of this specific match so results for
			// duplicate values each refer to their own element.
			const tracker: QueryTracker<T> = {element, index: i, deleted: false};

			resultsArray.push({
				element,
				key: queryKey,
				index: this.queryIndex.bind(this, tracker),
				delete: this.queryDelete.bind(this, tracker)
			});
		}

		return resultsArray;
	}

	/**
	 * Remove every element. Clears the slots in place and keeps the backing
	 * array at its length, so refilling the stack reuses its capacity.
	 */
	public clearElements(): Stack<T> {
		this._elements.fill(undefined, 0, this._size);
		this._size = 0;

		return this;
	}

	/**
	 * Same as `clearElements()`: the stack has no other state to restore.
	 */
	public reset(): Stack<T> {
		return this.clearElements();
	}

	/** Reverse the live elements in place, leaving the spare slots alone. */
	private reverseLive(): void {
		const elements = this._elements;

		for (let lo = 0, hi = this._size - 1; lo < hi; lo++, hi--) {
			const tmp = elements[lo];
			elements[lo] = elements[hi];
			elements[hi] = tmp;
		}
	}

	private parseOptions(options?: Options<T>): T[] {
		if (options?.elements == null) {
			return [];
		}

		if (!Array.isArray(options.elements)) {
			throw [Error('state elements must be an array')];
		}

		return options.elements.slice();
	}

	private queryDelete(tracker: QueryTracker<T>): T | null {
		const index = this.queryArrayIndex(tracker);

		if (index === null) {
			return null;
		}

		tracker.deleted = true;
		const elements = this._elements;
		const element = elements[index] as T;
		const last = this._size - 1;

		// Close the gap in place. splice would allocate a removed-items array
		// and shrink the backing array.
		elements.copyWithin(index, index + 1, this._size);
		elements[last] = undefined;
		this._size = last;

		return element;
	}

	/**
	 * Position of a query result's element counted down from the top of the
	 * stack, matching at() and forEach. Null once the element is gone.
	 */
	private queryIndex(tracker: QueryTracker<T>): number | null {
		const index = this.queryArrayIndex(tracker);

		if (index === null) {
			return null;
		}

		return this._size - 1 - index;
	}

	/**
	 * Current position of a query result's element in the backing array.
	 */
	private queryArrayIndex(tracker: QueryTracker<T>): number | null {
		if (tracker.deleted) {
			return null;
		}

		// Elements only ever move toward the bottom (deletes below shift them
		// down) or leave the stack (pops, deletes at that position). Search
		// live slots from the last known position downward so a duplicate
		// value higher in the stack is never mistaken for this element.
		const elements = this._elements;

		for (let i = Math.min(tracker.index, this._size - 1); i >= 0; i--) {
			if (elements[i] === tracker.element) {
				tracker.index = i;

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

/** Mutable record shared by a query result's index() and delete() closures. */
interface QueryTracker<T> {
	element: T;
	/** Last known array position of element. */
	index: number;
	/** True once delete() has removed element from the stack. */
	deleted: boolean;
}
