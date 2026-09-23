import type {ADT} from './adt';
import type {ArrayMethod} from './array/method';
import type {StackOptions as Options} from './stack/options';
import type {QueryFilter} from './query/filter';
import {type QueryOptions} from './query/options';
import type {QueryResult} from './query/result';
import {StackIterator} from './stack/iterator';
import {StackState as State} from './stack/state';
import {isNumber} from './utility';

/**
 * Stack ADT with standard FILO functionality.
 *
 * @category Stack
 */
export class Stack<T> implements ADT<T> {
	public readonly state: State<T>;

	constructor(options?: Options<T>) {
		this.state = this.parseOptions(options);
	}

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
	 * Remove and return the top element.
	 * @returns		Removed element or null when stack is empty.
	 */
	public pop(): T | null {
		if (this.isEmpty()) {
			return null;
		}

		return this.state.elements.pop() as T;
	}

	public push(element: T): Stack<T> {
		this.state.elements.push(element);

		return this;
	}

	public top(): T | null {
		if (this.isEmpty()) {
			return null;
		}

		return this.state.elements[this.state.elements.length - 1];
	}

	public bottom(): T | null {
		if (this.isEmpty()) {
			return null;
		}

		return this.state.elements[0];
	}

	/**
	 * Get the Nth element down from the top of the stack. Position 0 is the top,
	 * matching forEach's index and the index reported by query results.
	 * @param n		Position to retrieve. Must be a non-negative integer.
	 * @returns		Element at position n, or null when n is not a valid position.
	 */
	public at(n: number): T | null {
		const size = this.size();

		if (!Number.isInteger(n) || n < 0 || n >= size) {
			return null;
		}

		return this.state.elements[size - 1 - n];
	}

	public size(): number {
		return this.state.elements.length;
	}

	public isEmpty(): boolean {
		return this.state.elements.length === 0;
	}

	/**
	 * Create a new stack containing only elements for which func returns true.
	 * Elements are visited top to bottom and keep their relative order in the new stack.
	 * @param func		Called with (element, index, arr) where index 0 is the top of the stack.
	 * @param thisArg	Value used as `this` when calling func. Defaults to this stack.
	 * @returns			New stack containing the matching elements.
	 */
	public filter(func: ArrayMethod<T, boolean>, thisArg?: unknown): Stack<T> {
		const boundThis = thisArg === undefined ? this : thisArg;
		const elements: T[] = [];

		this.forEach((elem, idx, arr) => {
			if (func.call(boundThis, elem, idx, arr)) {
				elements.push(elem);
			}
		});

		// Elements were collected top-first. Reverse once so the new
		// stack's array is bottom-first like this stack's.
		elements.reverse();

		return new Stack({...this.state, elements});
	}

	/**
	 * Call func once for each element, visiting elements from top to bottom.
	 * @param func		Called with (element, index, arr) where index 0 is the top of the stack
	 * 					and arr is a top-first copy of the stack's elements.
	 * @param thisArg	Value used as `this` when calling func. Defaults to this stack.
	 * @returns			This stack.
	 */
	public forEach(func: ArrayMethod<T, void>, thisArg?: unknown): Stack<T> {
		const boundThis = thisArg === undefined ? this : thisArg;
		const topFirst = this.state.elements.slice().reverse();

		for (let i = 0; i < topFirst.length; i++) {
			func.call(boundThis, topFirst[i], i, topFirst);
		}

		return this;
	}

	public reverse(): Stack<T> {
		if (this.size() <= 1) {
			return this;
		}

		this.state.elements = this.state.elements.reverse();
		return this;
	}

	/**
	 * Serialize the stack state to a JSON string.
	 * @returns		JSON string, or null when the state cannot be serialized
	 * 				(e.g. elements contain circular references or BigInt values).
	 */
	public stringify(): string | null {
		try {
			return JSON.stringify(this.state);
		} catch {
			return null;
		}
	}

	public query(filters: QueryFilter<T> | QueryFilter<T>[], opts?: QueryOptions): QueryResult<T>[] {
		const resultsArray: QueryResult<T>[] = [];
		const options = this.queryOptions(opts);
		const elements = this.state.elements;

		// Visit top to bottom, stopping once the limit is reached.
		for (let i = elements.length - 1; i >= 0 && resultsArray.length < options.limit; i--) {
			const element = elements[i];
			let take = false;

			if (Array.isArray(filters)) {
				take =
					!!filters.length &&
					filters.every((filter) => {
						return filter(element);
					});
			} else {
				take = filters(element);
			}

			if (!take) {
				continue;
			}

			// Track the array position of this specific match so results for
			// duplicate values each refer to their own element.
			const tracker: QueryTracker<T> = {element, index: i, deleted: false};

			const result: QueryResult<T> = {} as QueryResult<T>;
			result.element = element;
			result.key = (): string | null => null;
			result.index = this.queryIndex.bind(this, tracker);
			result.delete = this.queryDelete.bind(this, tracker);
			resultsArray.push(result);
		}

		return resultsArray;
	}

	public clearElements(): Stack<T> {
		this.state.elements = [];

		return this;
	}

	public reset(): Stack<T> {
		this.clearElements();

		this.state.type = 'Stack';

		return this;
	}

	private parseOptions(options?: Options<T>): State<T> {
		const fromSerial = this.parseOptionsSerialized(options);
		const finalState = this.parseOptionsOverrides(fromSerial, options);

		return finalState;
	}

	private parseOptionsSerialized(options?: Options<T>): State<T> {
		const state: State<T> = this.getDefaultState();

		if (!options) {
			return state;
		}

		let result: State<T> | null = null;

		if (typeof options.serializedState === 'string') {
			const parsed = this.parseSerializedString(options.serializedState);

			if (Array.isArray(parsed)) {
				throw parsed;
			}

			result = parsed;
		}

		if (result) {
			state.elements = result.elements;
		}

		return state;
	}

	private parseSerializedString(state: string): State<T> | Error[] | null {
		if (typeof state !== 'string' || state === '') {
			return null;
		}

		let result: State<T> | Error[] | null = null;
		let errors: Error[] = [];

		try {
			const parsed = JSON.parse(state);

			if (parsed) {
				errors = this.getStateErrors(parsed);
			}

			if (errors.length || !parsed) {
				throw new Error('state is not a valid StackState');
			}

			result = parsed;
		} catch (e: unknown) {
			if (e instanceof Error) {
				errors.push(e);
			}

			result = errors;
		}

		return result;
	}

	private parseOptionsOverrides(stateArg: State<T>, options?: Options<T>): State<T> {
		const state: State<T> = stateArg;

		if (!options) {
			return state;
		}

		const errors: Error[] = [];

		if (options.elements != null) {
			const e = this.getStateErrorsElements(options.elements);

			if (e.length) {
				errors.push(...e);
			} else {
				state.elements = options.elements.slice();
			}
		}

		if (errors.length) {
			throw errors;
		}

		return state;
	}

	private getDefaultState(): State<T> {
		const state: State<T> = {
			type: 'Stack',
			elements: []
		};

		return state;
	}

	private getStateErrors(state: State<T>): Error[] {
		const errors: Error[] = [];

		errors.push(...this.getStateErrorsElements(state.elements));
		errors.push(...this.getStateErrorsType(state.type));

		return errors;
	}

	private getStateErrorsElements(data: unknown): Error[] {
		const errors: Error[] = [];

		if (data == null || !Array.isArray(data)) {
			errors.push(Error('state elements must be an array'));
		}

		return errors;
	}

	private getStateErrorsType(data: unknown): Error[] {
		const errors: Error[] = [];

		if (data == null || data !== 'Stack') {
			errors.push(Error('state type must be Stack'));
		}

		return errors;
	}

	private queryDelete(tracker: QueryTracker<T>): T | null {
		const index = this.queryArrayIndex(tracker);

		if (index === null) {
			return null;
		}

		tracker.deleted = true;
		const result = this.state.elements.splice(index, 1);

		return result[0];
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

		return this.size() - 1 - index;
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
		// from the last known position downward so a duplicate value higher
		// in the stack is never mistaken for this element.
		const index = this.state.elements.lastIndexOf(tracker.element, tracker.index);

		if (index < 0) {
			return null;
		}

		tracker.index = index;

		return index;
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

	public toBinary(): Uint8Array | null {
		return null;
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
