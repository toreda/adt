import {ADT} from '../adt';
import {LinkedListElement as Element} from './list/element';
import {LinkedListIterator} from './list/iterator';
import {LinkedListOptions as Options} from './list/options';
import {QueryFilter} from '../query/filter';
import {QueryOptions} from '../query/options';
import {QueryResult} from '../query/result';
import {LinkedListState as State} from './list/state';
import {isNumber} from '../utility';

/**
 * @category Linked List
 */
export class LinkedList<T> implements ADT<T> {
	private readonly state: State<T>;

	constructor(options?: Options<T>) {
		this.state = this.parseOptions(options);

		this.insertArray(this.state.elements);
		this.state.elements = [];
	}

	[Symbol.iterator](): LinkedListIterator<T> {
		return new LinkedListIterator<T>(this);
	}

	/**
	 * Insert element at head of list, making provided element
	 * the new Linked List head.
	 *
	 * @param element
	 * @returns
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

	/**
	 * Alias of insertAtTail.
	 */
	public insert(element: T): Element<T> | null {
		return this.insertAtTail(element);
	}

	/**
	 * Insert each provided element at tail.
	 *
	 * @param elements
	 * @returns
	 */
	public insertArray(elements?: T[] | null): void {
		if (!Array.isArray(elements)) {
			return;
		}

		for (const element of elements) {
			this.insertAtTail(element);
		}
	}

	public removeNode(node: Element<T> | null): T | null {
		if (!node) {
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

	public removeNodes(nodes: Array<Element<T> | null>): T[] {
		const deleted: T[] = [];

		nodes.forEach((node) => {
			const result = this.removeNode(node);
			if (result != null) {
				deleted.push(result);
			}
		});

		return deleted;
	}

	/**
	 * Get first element in Linked List if one exists.
	 *
	 * @returns				Returns first element when list length is >= 1.
	 *						Returns null when list is empty.
	 */
	public head(): Element<T> | null {
		return this.state.head;
	}

	/**
	 * Get last element in Linked List if one exists.
	 *
	 * @returns 			Returns last element when list length is >= 1.
	 * 						Returns null when list is empty.
	 */
	public tail(): Element<T> | null {
		return this.state.tail;
	}

	/**
	 * Get number of elements in Linked List.
	 * @returns				List size as a positive integer, or 0 if empty.
	 */
	public size(): number {
		return this.state.size;
	}

	/**
	 * Quickly check whether list has elements.
	 * @returns
	 */
	public isEmpty(): boolean {
		return this.state.size === 0;
	}

	public filter(func: ArrayMethod<T, boolean>, thisArg?: unknown): LinkedList<T> {
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

		return new LinkedList<T>({
			elements: elements
		});
	}

	public forEach(func: ArrayMethod<T, void>, thisArg?: unknown): LinkedList<T> {
		const arr = this.toArray();

		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const boundThis = (thisArg ? thisArg : this) as this;

		arr.forEach((elem, idx, thisArr) => {
			func.call(boundThis, elem, idx, thisArr);
		});

		return this;
	}

	public reverse(): LinkedList<T> {
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

	public stringify(): string {
		const list: T[] = [];

		if (!this.head() || !this.tail() || this.size() === 0) {
			return JSON.stringify(this.state);
		}

		this.forEach((element: Element<T>) => {
			const value = element.value();
			if (value !== null) {
				list.push(value);
			}
		});

		const state: State<T> = {...this.state};
		state.elements = list;
		state.head = null;
		state.tail = null;

		const result = JSON.stringify(state);

		state.elements = [];

		return result;
	}

	public toArray(): Element<T>[] {
		const result: Element<T>[] = [];

		let node = this.head();

		while (node) {
			result.push(node);
			node = node.next();
		}

		return result;
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

	public clearElements(): LinkedList<T> {
		this.forEach((element) => {
			element.prev(null);
			element.next(null);
		});

		this.state.head = null;
		this.state.tail = null;
		this.state.size = 0;

		return this;
	}

	public reset(): LinkedList<T> {
		this.clearElements();

		this.state.type = 'LinkedList';
		this.state.elements = [];

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

	private parseSerializedString(data: string): State<T> | Error[] | null {
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

			if (errors.length || !parsed) {
				throw new Error('state is not a valid LinkedListState');
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
			type: 'LinkedList',
			elements: [],
			size: 0,
			head: null,
			tail: null
		};

		return state;
	}

	private getStateErrors(state: State<T>): Error[] {
		const errors: Error[] = [];

		errors.push(...this.getStateErrorsElements(state.elements));
		errors.push(...this.getStateErrorsSize(state.size));
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

	private getStateErrorsSize(data: unknown): Error[] {
		const errors: Error[] = [];

		if (data == null || typeof data !== 'number') {
			errors.push(Error('state size must a number'));
		}

		return errors;
	}

	private getStateErrorsType(data: unknown): Error[] {
		const errors: Error[] = [];

		if (data == null || data !== 'LinkedList') {
			errors.push(Error('state type must be LinkedList'));
		}

		return errors;
	}

	private isPartOfList(node: Element<T>): boolean {
		let result = false;

		this.forEach((elem) => {
			if (elem === node) {
				result = true;
			}
		});

		return result;
	}

	private queryDelete(query: QueryResult<Element<T>>): T | null {
		this.removeNode(query.element);

		return query.element.value();
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

export type ArrayMethod<T, U> = (element: Element<T>, index: number, arr: Element<T>[]) => U;
