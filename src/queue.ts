import {ADTBase} from './base';
import {ADTQueryFilter as QueryFilter} from './query/filter';
import {ADTQueryOptions as QueryOptions} from './query/options';
import {ADTQueryResult as QueryResult} from './query/result';
import {ADTQueueOptions as QueueOptions} from './queue/options';
import {ADTQueueState as QueueState} from './queue/state';

export class Queue<T> implements ADTBase<T> {
	public state: QueueState<T>;

	constructor(options?: QueueOptions<T>) {
		// Shallow clone by default.
		// TODO: Add deep copy option.
		this.state = this.parseOptions(options);
	}

	public parseOptions(options?: QueueOptions<T>): QueueState<T> {
		const state = this.parseOptionsState(options);
		const finalState = this.parseOptionsOther(state, options);

		return finalState;
	}

	public parseOptionsState(options?: QueueOptions<T>): QueueState<T> {
		const state: QueueState<T> = this.getDefaultState();

		if (!options) {
			return state;
		}

		let parsed: QueueState<T> | Array<string> | null = null;
		let result: QueueState<T> | null = null;

		if (typeof options.serializedState === 'string') {
			parsed = this.parseOptionsStateString(options.serializedState);

			if (Array.isArray(parsed)) {
				throw new Error(parsed.join('\n'));
			}

			result = parsed;
		}

		if (result) {
			state.elements = result.elements;
			state.deepClone = result.deepClone;
			state.objectPool = result.objectPool;
		}

		return state;
	}

	public parseOptionsStateString(state: string): QueueState<T> | Array<string> | null {
		if (typeof state !== 'string' || state === '') {
			return null;
		}

		let result: QueueState<T> | Array<string> | null = null;
		let parsed: QueueState<T> | null = null;
		let errors: Array<string> = [];

		try {
			parsed = JSON.parse(state);

			if (parsed) {
				errors = this.getStateErrors(parsed);
			}

			if (errors.length) {
				throw new Error('state is not a valid ADTQueueState');
			}

			result = parsed;
		} catch (error) {
			result = [error.message].concat(errors);
		}

		return result;
	}

	public parseOptionsOther(s: QueueState<T>, options?: QueueOptions<T>): QueueState<T> {
		let state: QueueState<T> | null = s;

		if (!s) {
			state = this.getDefaultState();
		}

		if (!options) {
			return state;
		}

		if (options.elements && Array.isArray(options.elements)) {
			state.elements = options.elements.slice();
		}
		if (typeof options.deepClone === 'boolean') {
			state.deepClone = options.deepClone;
		}
		if (typeof options.objectPool === 'boolean') {
			state.objectPool = options.objectPool;
		}

		return state;
	}

	public getDefaultState(): QueueState<T> {
		const state: QueueState<T> = {
			type: 'qState',
			elements: [],
			deepClone: false,
			objectPool: false
		};

		return state;
	}

	public getStateErrors(state: QueueState<T>): Array<string> {
		const errors: Array<string> = [];

		if (!state) {
			errors.push('state is null or undefined');
			return errors;
		}

		if (state.type !== 'qState') {
			errors.push('state type must be qState');
		}
		if (!Array.isArray(state.elements)) {
			errors.push('state elements must be an array');
		}

		if (typeof state.deepClone !== 'boolean') {
			errors.push('state deepClone must be a boolean');
		}
		if (typeof state.objectPool !== 'boolean') {
			errors.push('state objectPool must be a boolean');
		}

		return errors;
	}

	public isValidState(state: QueueState<T>): boolean {
		const errors = this.getStateErrors(state);

		if (errors.length) {
			return false;
		}

		return true;
	}

	public queryDelete(query: QueryResult<T>): T | null {
		if (!query || !query.index) {
			return null;
		}

		const index = query.index();

		if (index === null) {
			return null;
		}

		const result = this.state.elements.splice(index, 1);

		if (!result.length) {
			return null;
		}

		return result[0];
	}

	public queryIndex(query: T): number | null {
		const index = this.state.elements.findIndex((element) => {
			return element === query;
		});

		if (index < 0) {
			return null;
		}

		return index;
	}

	public queryOptions(opts?: QueryOptions): Required<QueryOptions> {
		const options: Required<QueryOptions> = {
			limit: Infinity
		};

		if (opts?.limit && typeof opts.limit === 'number' && opts.limit >= 1) {
			options.limit = Math.round(opts.limit);
		}

		return options;
	}

	/**
	 * Clear all elements from queue.
	 */
	public clearElements(): Queue<T> {
		this.state.elements = [];

		return this;
	}

	public forEach(func: (element: T, index: number, arr: T[]) => void, thisArg?: any): Queue<T> {
		let boundThis = this;
		if (thisArg) {
			boundThis = thisArg;
		}

		this.state.elements.forEach((elem, idx) => {
			func.call(boundThis, elem, idx, this.state.elements);
		}, boundThis);

		return this;
	}

	/**
	 * Returns first element in queue, or null if queue is empty.
	 *
	 * @returns First element in queue of type <T> or null.
	 *
	 */
	public front(): T | null {
		if (this.isEmpty()) {
			return null;
		}

		return this.state.elements[0];
	}

	/**
	 * Returns true if queue is empty or false
	 * when >= 1 elements queued.
	 */
	public isEmpty(): boolean {
		return this.size() === 0;
	}

	/**
	 * Remove and return first element from queue. Returns
	 * null if queue is empty when called.
	 */
	public pop(): T | null {
		if (this.isEmpty()) {
			return null;
		}

		const element = this.state.elements[0];
		this.state.elements.splice(0, 1);
		return element;
	}

	/**
	 * Add element to the end of the queue.
	 */
	public push(element: any): Queue<T> {
		this.state.elements.push(element);

		return this;
	}

	public query(filters: QueryFilter<T> | QueryFilter<T>[], opts?: QueryOptions): QueryResult<T>[] {
		const resultsArray: QueryResult<T>[] = [];
		const options = this.queryOptions(opts);

		this.forEach((element) => {
			let take = false;

			if (resultsArray.length >= options.limit) {
				return false;
			}

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
				return false;
			}

			const result: QueryResult<T> = {} as QueryResult<T>;
			result.element = element;
			result.key = (): string | null => null;
			result.index = this.queryIndex.bind(this, element);
			result.delete = this.queryDelete.bind(this, result);
			resultsArray.push(result);
		});

		return resultsArray;
	}

	public reset(): Queue<T> {
		this.clearElements();

		this.state.type = 'qState';

		return this;
	}

	/**
	 * Reverse stored element order.
	 */
	public reverse(): Queue<T> {
		this.state.elements.reverse();

		return this;
	}

	/**
	 * Returns number of elements in queue.
	 */
	public size(): number {
		if (!this.isValidState(this.state)) {
			return 0;
		}

		return this.state.elements.length;
	}

	public stringify(): string | null {
		if (!this.isValidState(this.state)) {
			return null;
		}

		return JSON.stringify(this.state);
	}
}
