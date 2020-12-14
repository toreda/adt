import {ADTBase} from './base';
import {ADTLinkedListElement as Element} from './linked-list/element';
import {ADTLinkedListOptions as Options} from './linked-list/options';
import {ADTQueryFilter as QueryFilter} from './query/filter';
import {ADTQueryOptions as QueryOptions} from './query/options';
import {ADTQueryResult as QueryResult} from './query/result';
import {ADTLinkedListState as State} from './linked-list/state';

export class ADTLinkedList<T> implements ADTBase<T> {
	public readonly state: State<T>;

	constructor(options?: Options<T>) {
		this.state = this.parseOptions(options);

		this.state.elements.forEach((element: T) => {
			this.insert(element);
		});

		this.state.elements = [];
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
			state.objectPool = result.objectPool;
		}

		return state;
	}

	public parseOptionsStateString(data: string): State<T> | Error[] | null {
		if (typeof data !== 'string' || data === '') {
			return null;
		}

		let result: State<T> | Error[] | null = null;
		let errors: Error[] = [];

		try {
			const parsed = JSON.parse(data);

			if (parsed) {
				errors = this.getStateErrors(parsed);
			}

			if (errors.length) {
				throw new Error('state is not a valid ADTLinkedListState');
			}

			result = parsed;
		} catch (error) {
			result = [error, ...errors];
		}

		return result;
	}

	public parseOptionsOther(stateArg: State<T>, options?: Options<T>): State<T> {
		let state: State<T> | null = stateArg;

		if (!stateArg) {
			state = this.getDefaultState();
		}

		if (!options) {
			return state;
		}

		if (options.elements != null && this.getStateErrorsElements(options.elements).length === 0) {
			state.elements = options.elements.slice();
		}
		if (options.objectPool != null && this.getStateErrorsObjectPool(options.objectPool).length === 0) {
			state.objectPool = options.objectPool;
		}

		return state;
	}

	public getDefaultState(): State<T> {
		const state: State<T> = {
			type: 'LinkedList',
			elements: [],
			objectPool: false,
			size: 0,
			head: null,
			tail: null
		};

		return state;
	}

	public getStateErrors(state: State<T>): Error[] {
		const errors: Error[] = [];

		if (!state) {
			errors.push(Error('state is null or undefined'));
			return errors;
		}

		errors.push(...this.getStateErrorsElements(state.elements));
		errors.push(...this.getStateErrorsObjectPool(state.objectPool));
		errors.push(...this.getStateErrorsType(state.type));

		return errors;
	}

	public getStateErrorsElements(data: unknown): Error[] {
		const result: Error[] = [];

		if (data == null || !Array.isArray(data)) {
			result.push(Error('state elements must be an array'));
		}

		return result;
	}

	public getStateErrorsObjectPool(data: unknown): Error[] {
		const result: Error[] = [];

		if (data == null || typeof data !== 'boolean') {
			result.push(Error('state objectPool must be a boolean'));
		}

		return result;
	}

	public getStateErrorsType(data: unknown): Error[] {
		const result: Error[] = [];

		if (data == null || data !== 'LinkedList') {
			result.push(Error('state type must be LinkedList'));
		}

		return result;
	}

	public isPartOfList(node: Element<T> | null): boolean {
		if (node == null) {
			return false;
		}

		let result = false;

		this.forEach((elem) => {
			if (elem === node) {
				result = true;
			}
		});

		return result;
	}

	public queryDelete(query: QueryResult<Element<T>>): T | null {
		this.deleteNode(query.element);

		return query.element.value();
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
	 * Remove all elements from the linked list.
	 */
	public clearElements(): ADTLinkedList<T> {
		this.forEach((element) => {
			element.prev(null);
			element.next(null);
		});

		this.state.head = null;
		this.state.tail = null;
		this.state.size = 0;

		return this;
	}

	public deleteNode(node: Element<T> | null): T | null {
		if (node == null) {
			return null;
		}

		if (!this.isPartOfList(node)) {
			return node.value();
		}

		const next = node.next();
		const prev = node.prev();

		if (next) {
			next.prev(prev);
		}
		if (prev) {
			prev.next(next);
		}

		if (node === this.head()) {
			this.state.head = next;
		}
		if (node === this.tail()) {
			this.state.tail = prev;
		}

		this.state.size--;
		node.next(null);
		node.prev(null);

		return node.value();
	}

	// prettier-ignore
	// eslint-disable-next-line max-len, prettier/prettier
	public filter(func: (element: Element<T>, index: number, arr: Element<T>[]) => boolean, thisArg?: unknown): ADTLinkedList<T> {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		let boundThis = this;
		if (thisArg) {
			boundThis = thisArg as this;
		}

		const elements: T[] = [];

		this.forEach((elem, idx, arr) => {
			const result = func.call(boundThis, elem, idx, arr);
			const e = elem.value();
			if (result && e != null) {
				elements.push(e);
			}
		}, boundThis);

		return new ADTLinkedList({...this.state, elements});
	}

	// prettier-ignore
	// eslint-disable-next-line max-len, prettier/prettier
	public forEach(func: (element: Element<T>, index: number, arr: Element<T>[]) => void, thisArg?: unknown): ADTLinkedList<T> {
		const arr = this.getAsArray();

		// eslint-disable-next-line @typescript-eslint/no-this-alias
		let boundThis = this;
		if (thisArg) {
			boundThis = thisArg as this;
		}

		arr.forEach((elem, idx, thisArr) => {
			func.call(boundThis, elem, idx, thisArr);
		});

		return this;
	}

	public getAsArray(): Element<T>[] {
		const result: Element<T>[] = [];

		let node = this.head();

		while (node) {
			result.push(node);
			node = node.next();
		}

		return result;
	}

	public head(): Element<T> | null {
		return this.state.head;
	}

	/**
	 * Alias of insertAtTail for consistency.
	 */
	public insert(element: T): Element<T> | null {
		return this.insertAtTail(element);
	}

	/**
	 * Insert element at the front of the list, replacing the current
	 * head if one exists.
	 */
	public insertAtHead(element: T): Element<T> | null {
		const node = new Element<T>(element);
		const head = this.head();

		if (!head) {
			this.state.head = node;
			this.state.tail = node;

			this.state.head.prev(null);
			this.state.head.next(null);
		} else {
			head.prev(node);

			node.prev(null);
			node.next(head);

			this.state.head = node;
		}

		++this.state.size;
		return node;
	}

	/**
	 * Insert element at the end of the list.
	 */
	public insertAtTail(element: T): Element<T> {
		const node = new Element<T>(element);
		const tail = this.tail();

		if (!tail) {
			this.state.head = node;
			this.state.tail = node;

			this.state.tail.prev(null);
			this.state.tail.next(null);
		} else {
			tail.next(node);

			node.prev(tail);
			node.next(null);

			this.state.tail = node;
		}

		++this.state.size;
		return node;
	}

	public query(filters: QueryFilter<T> | QueryFilter<T>[], opts?: QueryOptions): QueryResult<Element<T>>[] {
		const resultsArray: QueryResult<Element<T>>[] = [];
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
						const value = element.value();
						if (value == null) {
							return false;
						}
						return filter(value);
					});
			} else {
				const value = element.value();
				if (value != null) {
					take = filters(value);
				}
			}

			if (!take) {
				return false;
			}

			const result: QueryResult<Element<T>> = {} as QueryResult<Element<T>>;
			result.element = element;
			result.key = (): string | null => null;
			result.index = (): number | null => null;
			result.delete = this.queryDelete.bind(this, result);
			resultsArray.push(result);
		});

		return resultsArray;
	}

	public reset(): ADTLinkedList<T> {
		this.clearElements();

		this.state.type = 'LinkedList';
		this.state.elements = [];

		return this;
	}

	/**
	 * Reverse the linked list in place.
	 */
	public reverse(): ADTLinkedList<T> {
		let curr = this.state.head;

		if (!curr || this.size() <= 1) {
			return this;
		}

		let prev = curr.prev();
		this.state.tail = curr;

		while (curr !== null) {
			const next = curr.next();
			curr.next(prev);
			curr.prev(next);

			if (next === null) {
				this.state.head = curr;
			}

			prev = curr;
			curr = next;
		}

		return this;
	}

	/**
	 * Returns number of elements in queue.
	 */
	public size(): number {
		return this.state.size;
	}

	public stringify(): string {
		const list: Array<T> = [];

		if (!this.head() || !this.tail() || this.size() === 0) {
			return JSON.stringify(this.state);
		}

		this.forEach((element) => {
			const value = element.value();
			if (value != null) {
				list.push(value);
			}
		});

		const state: State<T> = {...this.state};
		state.elements = list;
		state.head = null;
		state.tail = null;

		return JSON.stringify(state);
	}

	/**
	 * Return the tail element if present. Returns null
	 * on empty list.
	 */
	public tail(): Element<T> | null {
		return this.state.tail;
	}
}
