import {isInteger, isNumber} from './utility';

import {ADTBase} from './base';
import {ADTStackOptions as Options} from './stack/options';
import {ADTQueryFilter as QueryFilter} from './query/filter';
import {ADTQueryOptions as QueryOptions} from './query/options';
import {ADTQueryResult as QueryResult} from './query/result';
import {ADTStackState as State} from './stack/state';

export class ADTStack<T> implements ADTBase<T> {
	private readonly state: State<T>;

	constructor(options?: Options<T>) {
		this.state = this.parseOptions(options);

		this.state.size = this.state.elements.length;
		this.state.top = this.size() - 1;
	}

	public push(element: T): ADTStack<T> {
		this.state.elements.push(element);
		this.state.top++;
		this.state.size++;
		return this;
	}

	public top(): T | null {
		if (!this.size()) {
			return null;
		}

		return this.state.elements[this.state.top];
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

	public size(): number {
		return this.state.size;
	}

	public bottom(): T | null {
		if (!this.size()) {
			return null;
		}

		return this.state.elements[this.state.bottom];
	}

	public filter(func: (element: T, index: number, arr: T[]) => boolean, thisArg?: unknown): ADTStack<T> {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		let boundThis = this;

		if (thisArg) {
			boundThis = thisArg as this;
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

	public forEach(func: (element: T, index: number, arr: T[]) => void, thisArg?: unknown): ADTStack<T> {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		let boundThis = this;

		if (thisArg) {
			boundThis = thisArg as this;
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

	public reverse(): ADTStack<T> {
		if (this.size() <= 1) {
			return this;
		}

		this.state.elements = this.state.elements.reverse();
		return this;
	}

	public stringify(): string {
		return JSON.stringify(this.state);
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

	public clearElements(): ADTStack<T> {
		this.state.elements = [];
		this.state.top = -1;
		this.state.size = 0;

		return this;
	}

	public reset(): ADTStack<T> {
		this.clearElements();
		this.state.bottom = 0;

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
			state.size = result.size;
			state.top = result.top;
			state.bottom = result.bottom;
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
				throw new Error('state is not a valid ADTStackState');
			}

			result = parsed;
		} catch (error) {
			result = [error, ...errors];
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
			elements: [],
			size: 0,
			top: -1,
			bottom: 0
		};

		return state;
	}

	private getStateErrors(state: State<T>): Error[] {
		const errors: Error[] = [];

		errors.push(...this.getStateErrorsBottom(state.bottom));
		errors.push(...this.getStateErrorsElements(state.elements));
		errors.push(...this.getStateErrorsSize(state.size));
		errors.push(...this.getStateErrorsTop(state.top));
		errors.push(...this.getStateErrorsType(state.type));

		return errors;
	}

	private getStateErrorsBottom(data: unknown): Error[] {
		const errors: Error[] = [];

		if (data == null || data !== 0) {
			errors.push(Error('state bottom must be 0'));
		}

		return errors;
	}

	private getStateErrorsElements(data: unknown): Error[] {
		const errors: Error[] = [];

		if (data == null || !Array.isArray(data)) {
			errors.push(Error('state elements must be an array'));
		}

		return errors;
	}

	private getStateErrorsSize(data: unknown): Error[] {
		const errors: Error[] = [];

		if (data == null || !isInteger(data) || data < 0) {
			errors.push(Error('state size must be an integer >= 0'));
		}

		return errors;
	}

	private getStateErrorsTop(data: unknown): Error[] {
		const errors: Error[] = [];

		if (data == null || !isInteger(data)) {
			errors.push(Error('state top must be an integer'));
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

	private queryDelete(query: QueryResult<T>): T | null {
		const index = query.index();

		if (index === null) {
			return null;
		}

		const result = this.state.elements.splice(index, 1);
		this.state.top--;
		this.state.size--;

		return result[0];
	}

	private queryIndex(query: T): number | null {
		const index = this.state.elements.findIndex((element) => {
			return element === query;
		});

		if (index < 0) {
			return null;
		}

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
}
