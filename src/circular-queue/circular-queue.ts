import ADTBase from '../base/base';
import ADTCircularQueueOptions from './circular-queue-options';
import ADTCircularQueueState from './circular-queue-state';
import ADTQueryFilter from '../query/query-filter';
import ADTQueryOptions from '../query/query-options';
import ADTQueryResult from '../query/query-result';

export default class ADTCircularQueue<T> implements ADTBase<T> {
	public state: ADTCircularQueueState<T>;

	constructor(options?: ADTCircularQueueOptions<T>) {
		this.state = this.parseOptions(options);
	}

	public parseOptions(options?: ADTCircularQueueOptions<T>): ADTCircularQueueState<T> {
		const state = this.parseOptionsState(options);
		const finalState = this.parseOptionsOther(state, options);

		return finalState;
	}

	public parseOptionsState(options?: ADTCircularQueueOptions<T>): ADTCircularQueueState<T> {
		const state: ADTCircularQueueState<T> = this.getDefaultState();

		if (!options) {
			return state;
		}

		let parsed: ADTCircularQueueState<T> | Array<string> | null = null;
		let result: ADTCircularQueueState<T> | null = null;

		if (typeof options.serializedState === 'string') {
			parsed = this.parseOptionsStateString(options.serializedState);

			if (Array.isArray(parsed)) {
				throw new Error(parsed.join('\n'));
			}

			result = parsed;
		}

		if (result) {
			state.elements = result.elements;
			state.overwrite = result.overwrite;
			state.maxSize = result.maxSize;
			state.size = result.size;
			state.front = result.front;
			state.rear = result.rear;
		}

		return state;
	}

	public parseOptionsStateString(data: string): ADTCircularQueueState<T> | Array<string> | null {
		if (typeof data !== 'string' || data === '') {
			return null;
		}

		let result: ADTCircularQueueState<T> | Array<string> | null = null;
		let parsed: ADTCircularQueueState<T> | null = null;
		let errors: Array<string> = [];

		try {
			parsed = JSON.parse(data);

			if (parsed) {
				errors = this.getStateErrors(parsed);
			}

			if (errors.length) {
				throw new Error('state is not a valid ADTCircularQueueState');
			}

			result = parsed;
		} catch (error) {
			result = [error.message].concat(errors);
		}

		return result;
	}

	public parseOptionsOther(
		s: ADTCircularQueueState<T>,
		options?: ADTCircularQueueOptions<T>
	): ADTCircularQueueState<T> {
		let state: ADTCircularQueueState<T> | null = s;

		if (!s) {
			state = this.getDefaultState();
		}

		if (!options) {
			return state;
		}

		if (options.elements && Array.isArray(options.elements)) {
			state.elements = options.elements.slice();
		}

		if (options.size && this.isInteger(options.size) && options.size >= 0) {
			state.size = options.size;
		}
		if (options.front && this.isInteger(options.front)) {
			state.front = options.front;
		}
		if (options.rear && this.isInteger(options.rear)) {
			state.rear = options.rear;
		}

		if (options.maxSize && this.isInteger(options.maxSize) && options.maxSize >= 1) {
			state.maxSize = options.maxSize;
		}

		return state;
	}

	public getDefaultState(): ADTCircularQueueState<T> {
		const state: ADTCircularQueueState<T> = {
			type: 'cqState',
			elements: [],
			overwrite: false,
			size: 0,
			maxSize: 100,
			front: 0,
			rear: 0
		};

		return state;
	}

	public getStateErrors(state: ADTCircularQueueState<T>): Array<string> {
		const errors: Array<string> = [];

		if (!state) {
			errors.push('state is null or undefined');
			return errors;
		}

		if (state.type !== 'cqState') {
			errors.push('state type must be cqState');
		}
		if (!Array.isArray(state.elements)) {
			errors.push('state elements must be an array');
		}
		if (typeof state.overwrite !== 'boolean') {
			errors.push('state overwrite must be a boolean');
		}

		if (!this.isInteger(state.size) || state.size < 0) {
			errors.push('state size must be an integer >= 0');
		}
		if (!this.isInteger(state.maxSize) || state.maxSize < 1) {
			errors.push('state maxSize must be an integer >= 1');
		}

		if (!this.isInteger(state.front)) {
			errors.push('state front must be an integer');
		}
		if (!this.isInteger(state.rear)) {
			errors.push('state rear must be an integer');
		}

		return errors;
	}

	public isInteger(n: number): boolean {
		if (typeof n !== 'number') {
			return false;
		}
		if (n % 1 !== 0) {
			return false;
		}

		return true;
	}

	public isValidState(state: ADTCircularQueueState<T>): boolean {
		const errors = this.getStateErrors(state);

		if (errors.length) {
			return false;
		}

		return true;
	}

	public queryDelete(query: ADTQueryResult<T>): T | null {
		if (!query || !query.index) {
			return null;
		}

		let index = query.index();

		if (index === null) {
			return null;
		}

		let front = this.wrapIndex(this.state.front);
		let rear = this.wrapIndex(this.state.rear);

		if (this.state.size && rear <= front) {
			rear = rear + this.state.maxSize;
		}

		if (this.state.size && index < front) {
			index = index + this.state.maxSize;
		}

		if (index >= rear) {
			delete this.state.elements[this.wrapIndex(index)];
			return query.element;
		}

		this.state.elements.splice(this.wrapIndex(index), 1);
		this.state.size--;
		this.state.rear = this.wrapIndex(this.state.rear - 1);

		return query.element;
	}

	public queryIndex(query: T): number | null {
		let position = -1;

		this.forEach((element, index) => {
			if (position !== -1) {
				return false;
			}
			if (element === query) {
				position = index;
			}
		});

		if (position < 0) {
			return null;
		}

		return position;
	}

	public queryOptions(opts?: ADTQueryOptions): Required<ADTQueryOptions> {
		let options: Required<ADTQueryOptions> = {
			limit: Infinity
		};

		if (opts?.limit && typeof opts.limit === 'number' && opts.limit >= 1) {
			options.limit = Math.round(opts.limit);
		}

		return options;
	}

	public wrapIndex(n: number): number {
		if (!this.isInteger(n)) {
			return -1;
		}

		let index = n;
		while (index < 0) {
			index += this.state.maxSize;
		}

		return index % this.state.maxSize;
	}

	public clearElements(): ADTCircularQueue<T> {
		this.state.elements = [];
		this.state.front = 0;
		this.state.rear = 0;
		this.state.size = 0;

		return this;
	}

	public forEach(func: (element: T, index: number) => void): ADTCircularQueue<T> {
		let front = this.wrapIndex(this.state.front);
		let rear = this.wrapIndex(this.state.rear);

		if (this.state.size && rear <= front) {
			rear = rear + this.state.maxSize;
		}

		for (let i = front; i < rear; i++) {
			let iWrap = this.wrapIndex(i);
			func(this.state.elements[iWrap], iWrap);
		}

		return this;
	}

	public front(): T | null {
		if (!this.isValidState(this.state)) {
			return null;
		}

		if (!this.state.size) {
			return null;
		}

		return this.state.elements[this.state.front];
	}

	public getIndex(n: number): T | null {
		if (!this.isValidState(this.state)) {
			return null;
		}
		if (!this.isInteger(n)) {
			return null;
		}
		if (!this.state.size) {
			return null;
		}

		let index = n;
		if (index >= 0) {
			index = this.state.front + index;
		} else {
			index = this.state.rear - 1 + index;
		}

		return this.state.elements[this.wrapIndex(index)];
	}

	public isEmpty(): boolean {
		if (!this.isValidState(this.state)) {
			return false;
		}

		return this.state.size === 0;
	}

	public isFull(): boolean {
		if (!this.isValidState(this.state)) {
			return false;
		}

		return this.state.size >= this.state.maxSize;
	}

	public pop(): T | null {
		if (!this.isValidState(this.state)) {
			return null;
		}

		if (this.isEmpty()) {
			return null;
		}

		const front = this.front();

		this.state.front = this.wrapIndex(this.state.front + 1);
		this.state.size--;

		return front;
	}

	public push(element: T): boolean {
		if (!this.isValidState(this.state)) {
			return false;
		}

		if (!this.state.overwrite && this.isFull()) {
			return false;
		}

		this.state.elements[this.state.rear] = element;
		this.state.rear = this.wrapIndex(this.state.rear + 1);

		if (this.state.overwrite && this.isFull()) {
			this.state.front = this.wrapIndex(this.state.front + 1);
		} else {
			this.state.size++;
		}

		return true;
	}

	public query(filters: ADTQueryFilter<T> | ADTQueryFilter<T>[], opts?: ADTQueryOptions): ADTQueryResult<T>[] {
		let resultsArray: ADTQueryResult<T>[] = [];
		let options = this.queryOptions(opts);

		this.forEach((element, index) => {
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

			const result: ADTQueryResult<T> = {} as ADTQueryResult<T>;
			result.element = element;
			result.key = () => null;
			result.index = this.queryIndex.bind(this, element);
			result.delete = this.queryDelete.bind(this, result);
			resultsArray.push(result);
		});

		return resultsArray;
	}

	public rear(): T | null {
		if (!this.isValidState(this.state)) {
			return null;
		}

		if (!this.state.size) {
			return null;
		}

		return this.state.elements[this.wrapIndex(this.state.rear - 1)];
	}

	public reset(): ADTCircularQueue<T> {
		this.clearElements();

		this.state.type = 'cqState';

		return this;
	}

	public stringify(): string | null {
		if (!this.isValidState(this.state)) {
			return null;
		}

		return JSON.stringify(this.state);
	}
}
