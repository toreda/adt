import {ADTBase} from './base';
import {ADTStackOptions as Options} from './stack/options';
import {ADTQueryFilter as QueryFilter} from './query/filter';
import {ADTQueryOptions as QueryOptions} from './query/options';
import {ADTQueryResult as QueryResult} from './query/result';
import {ADTStackState as State} from './stack/state';

export class ADTStack<T> implements ADTBase<T> {
	public state: State<T>;

	constructor(options?: Options<T>) {
		this.state = this.parseOptions(options);

		this.state.size = this.state.elements.length;
		this.state.top = this.size() - 1;
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

		let parsed: State<T> | Array<string> | null = null;
		let result: State<T> | null = null;

		if (typeof options.serializedState === 'string') {
			parsed = this.parseOptionsStateString(options.serializedState);

			if (Array.isArray(parsed)) {
				throw new Error(parsed.join('\n'));
			}

			result = parsed;
		}

		if (result) {
			state.elements = result.elements;
			state.size = result.size;
			state.top = result.top;
			state.bottom = result.bottom;
		}

		return state;
	}

	public parseOptionsStateString(state: string): State<T> | Array<string> | null {
		if (typeof state !== 'string' || state === '') {
			return null;
		}

		let result: State<T> | Array<string> | null = null;
		let parsed: State<T> | null = null;
		let errors: Array<string> = [];

		try {
			parsed = JSON.parse(state);

			if (parsed) {
				errors = this.getStateErrors(parsed);
			}

			if (errors.length) {
				throw new Error('state is not a valid ADTStackState');
			}

			result = parsed;
		} catch (error) {
			result = [error.message].concat(errors);
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

		if (options.elements && Array.isArray(options.elements)) {
			state.elements = options.elements.slice();
		}

		return state;
	}

	public getDefaultState(): State<T> {
		const state: State<T> = {
			type: 'Stack',
			elements: [],
			size: 0,
			top: -1,
			bottom: 0
		};

		return state;
	}

	public getStateErrors(state: State<T>): Array<string> {
		const errors: Array<string> = [];

		if (!state) {
			errors.push('state is null or undefined');
			return errors;
		}

		if (state.type !== 'Stack') {
			errors.push('state type must be Stack');
		}
		if (!Array.isArray(state.elements)) {
			errors.push('state elements must be an array');
		}

		if (!this.isInteger(state.size) || state.size < 0) {
			errors.push('state size must be an integer >= 0');
		}
		if (!this.isInteger(state.top)) {
			errors.push('state top must be an integer');
		}
		if (state.bottom !== 0) {
			errors.push('state bottom must be 0');
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

	public isValidState(state: State<T>): boolean {
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
		this.state.top--;
		this.state.size--;

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

	public bottom(): T | null {
		if (!this.size()) {
			return null;
		}

		return this.state.elements[this.state.bottom];
	}

	public clearElements(): ADTStack<T> {
		this.state.elements = [];
		this.state.top = -1;
		this.state.size = 0;

		return this;
	}

	public filter(func: (element: T, index: number, arr: T[]) => boolean, thisArg?: any): ADTStack<T> {
		let boundThis = this;
		if (thisArg) {
			boundThis = thisArg;
		}

		const elements: T[] = [];

		this.forEach((elem, idx, arr) => {
			const result = func.call(boundThis, elem, idx, arr);
			if (result) {
				elements.unshift(elem);
			}
		}, boundThis);

		return new ADTStack({...this.state, elements});
	}

	public forEach(func: (element: T, index: number, arr: T[]) => void, thisArg?: any): ADTStack<T> {
		let boundThis = this;
		if (thisArg) {
			boundThis = thisArg;
		}

		for (let i = this.state.top; i >= 0; i--) {
			func.call(
				boundThis,
				this.state.elements[i],
				this.state.top - i,
				this.state.elements.slice().reverse()
			);
		}

		return this;
	}

	public pop(): T | null {
		if (!this.size()) {
			return null;
		}

		const result = this.state.elements[this.state.top];
		this.state.top--;
		this.state.size--;

		return result;
	}

	public push(element: T): ADTStack<T> {
		this.state.elements.push(element);
		this.state.top++;
		this.state.size++;
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

	public reset(): ADTStack<T> {
		this.clearElements();
		this.state.bottom = 0;

		this.state.type = 'Stack';

		return this;
	}

	public reverse(): ADTStack<T> {
		if (this.size() <= 1) {
			return this;
		}

		this.state.elements = this.state.elements.reverse();
		return this;
	}

	public size(): number {
		if (!this.isValidState(this.state)) {
			return 0;
		}

		return this.state.size;
	}

	public stringify(): string | null {
		if (!this.isValidState(this.state)) {
			return null;
		}

		return JSON.stringify(this.state);
	}

	public top(): T | null {
		if (!this.size()) {
			return null;
		}

		return this.state.elements[this.state.top];
	}
}
