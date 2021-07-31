import {ADT} from './adt';
import {StackOptions as Options} from './stack/options';
import {QueryFilter} from './query/filter';
import {QueryOptions} from './query/options';
import {QueryResult} from './query/result';
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

	public peek(): T | null {
		return this.top();
	}

	public pop(): Stack<T> {
		this.state.elements.pop();

		return this;
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

	public size(): number {
		return this.state.elements.length;
	}

	public isEmpty(): boolean {
		return this.state.elements.length === 0;
	}

	public filter(func: ArrayMethod<T, boolean>, thisArg?: unknown): Stack<T> {
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

		return new Stack({...this.state, elements});
	}

	public forEach(func: ArrayMethod<T, void>, thisArg?: unknown): Stack<T> {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		let boundThis = this;

		if (thisArg) {
			boundThis = thisArg as this;
		}

		const top = this.state.elements.length - 1;
		for (let i = top; i >= 0; i--) {
			func.call(boundThis, this.state.elements[i], top - i, this.state.elements.slice().reverse());
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

	private queryDelete(query: QueryResult<T>): T | null {
		const index = query.index();

		if (index === null) {
			return null;
		}

		const result = this.state.elements.splice(index, 1);

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

type ArrayMethod<T, U> = (element: T, index: number, arr: T[]) => U;
