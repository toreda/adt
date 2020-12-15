import {ADTBase} from './base';
import {ADTQueueOptions as Options} from './queue/options';
import {ADTQueryFilter as QueryFilter} from './query/filter';
import {ADTQueryOptions as QueryOptions} from './query/options';
import {ADTQueryResult as QueryResult} from './query/result';
import {ADTQueueState as State} from './queue/state';

export class ADTQueue<T> implements ADTBase<T> {
	public state: State<T>;

	constructor(options?: Options<T>) {
		// Shallow clone by default.
		// TODO: Add deep copy option.
		this.state = this.parseOptions(options);
	}

	public parseOptions(options?: Options<T>): State<T> {
		const state = this.parseOptionsState(options);
		const finalState = this.parseOptionsOther(state, options);

		return finalState;
	}

	public parseOptionsState(options?: Options<T>): State<T> {
		const state: State<T> = this.getDefaultState();

		if (!options) {
			return state;
		}

		let result: State<T> | null = null;

		if (typeof options.serializedState === 'string') {
			const parsed = this.parseOptionsStateString(options.serializedState);

			if (Array.isArray(parsed)) {
				throw parsed;
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

	public parseOptionsStateString(state: string): State<T> | Error[] | null {
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

			if (errors.length) {
				throw new Error('state is not a valid ADTQueueState');
			}

			result = parsed;
		} catch (error) {
			result = [error, ...errors];
		}

		return result;
	}

	public parseOptionsOther(s: State<T>, options?: Options<T>): State<T> {
		let state: State<T> | null = s;

		if (!s) {
			state = this.getDefaultState();
		}

		if (!options) {
			return state;
		}

		if (options.elements != null && this.getStateErrorsElements(options.elements).length === 0) {
			state.elements = options.elements.slice();
		}
		if (options.deepClone != null && this.getStateErrorsDeepClone(options.deepClone).length === 0) {
			state.deepClone = options.deepClone;
		}
		if (options.objectPool != null && this.getStateErrorsObjectPool(options.objectPool).length === 0) {
			state.objectPool = options.objectPool;
		}

		return state;
	}

	public getDefaultState(): State<T> {
		const state: State<T> = {
			type: 'Queue',
			elements: [],
			deepClone: false,
			objectPool: false
		};

		return state;
	}

	public getStateErrors(state: State<T>): Error[] {
		const errors: Error[] = [];

		if (!state) {
			errors.push(Error('state is null or undefined'));
			return errors;
		}

		errors.push(...this.getStateErrorsDeepClone(state.deepClone));
		errors.push(...this.getStateErrorsElements(state.elements));
		errors.push(...this.getStateErrorsObjectPool(state.objectPool));
		errors.push(...this.getStateErrorsType(state.type));

		return errors;
	}

	public getStateErrorsDeepClone(data: unknown): Error[] {
		const errors: Error[] = [];

		if (data == null || typeof data !== 'boolean') {
			errors.push(Error('state deepClone must be a boolean'));
		}

		return errors;
	}

	public getStateErrorsElements(data: unknown): Error[] {
		const errors: Error[] = [];

		if (data == null || !Array.isArray(data)) {
			errors.push(Error('state elements must be an array'));
		}

		return errors;
	}

	public getStateErrorsObjectPool(data: unknown): Error[] {
		const errors: Error[] = [];

		if (data == null || typeof data !== 'boolean') {
			errors.push(Error('state objectPool must be a boolean'));
		}

		return errors;
	}

	public getStateErrorsType(data: unknown): Error[] {
		const errors: Error[] = [];

		if (data == null || data !== 'Queue') {
			errors.push(Error('state type must be Queue'));
		}

		return errors;
	}

	public isValidState(state: State<T>): boolean {
		return this.getStateErrors(state).length === 0;
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
	public clearElements(): ADTQueue<T> {
		this.state.elements = [];

		return this;
	}

	public filter(func: (element: T, index: number, arr: T[]) => boolean, thisArg?: unknown): ADTQueue<T> {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		let boundThis = this;

		if (thisArg) {
			boundThis = thisArg as this;
		}

		const elements: T[] = [];

		this.forEach((elem, idx, arr) => {
			const result = func.call(boundThis, elem, idx, arr);
			if (result) {
				elements.push(elem);
			}
		}, boundThis);

		return new ADTQueue({...this.state, elements});
	}

	public forEach(func: (element: T, index: number, arr: T[]) => void, thisArg?: unknown): ADTQueue<T> {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		let boundThis = this;

		if (thisArg) {
			boundThis = thisArg as this;
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
	public push(element: T): ADTQueue<T> {
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

	public reset(): ADTQueue<T> {
		this.clearElements();

		this.state.type = 'Queue';

		return this;
	}

	/**
	 * Reverse stored element order.
	 */
	public reverse(): ADTQueue<T> {
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
