import {ADTBase} from '../base/base';
import {ADTLinkedListElement} from './linked-list-element';
import {ADTLinkedListOptions} from './linked-list-options';
import {ADTLinkedListState} from './linked-list-state';
import {ADTQueryFilter} from '../query/query-filter';
import {ADTQueryOptions} from '../query/query-options';
import {ADTQueryResult} from '../query/query-result';

export class ADTLinkedList<T> implements ADTBase<T> {
	public readonly state: ADTLinkedListState<T>;

	constructor(options?: ADTLinkedListOptions<T>, elements?: T | T[]) {
		this.state = this.parseOptions(options);

		this.state.elements.forEach((element: T) => {
			this.insert(element);
		});

		this.state.elements = [];
	}

	public parseOptions(options?: ADTLinkedListOptions<T>): ADTLinkedListState<T> {
		const state = this.parseOptionsState(options);
		const finalState = this.parseOptionsOther(state, options);

		return finalState;
	}

	public parseOptionsState(options?: ADTLinkedListOptions<T>): ADTLinkedListState<T> {
		const state: ADTLinkedListState<T> = this.getDefaultState();

		if (!options) {
			return state;
		}

		let parsed: ADTLinkedListState<T> | Array<string> | null = null;
		let result: ADTLinkedListState<T> | null = null;

		if (typeof options.serializedState === 'string') {
			parsed = this.parseOptionsStateString(options.serializedState);

			if (Array.isArray(parsed)) {
				throw new Error(parsed.join('\n'));
			}

			result = parsed;
		}

		if (result) {
			state.elements = result.elements;
			state.objectPool = result.objectPool;
		}

		return state;
	}

	public parseOptionsStateString(data: string): ADTLinkedListState<T> | Array<string> | null {
		if (typeof data !== 'string' || data === '') {
			return null;
		}

		let result: ADTLinkedListState<T> | Array<string> | null = null;
		let parsed: ADTLinkedListState<T> | null = null;
		let errors: Array<string> = [];

		try {
			parsed = JSON.parse(data);

			if (parsed) {
				errors = this.getStateErrors(parsed);
			}

			if (errors.length) {
				throw new Error('state is not a valid ADTLinkedListState');
			}

			result = parsed;
		} catch (error) {
			result = [error.message].concat(errors);
		}

		return result;
	}

	public parseOptionsOther(
		s: ADTLinkedListState<T>,
		options?: ADTLinkedListOptions<T>
	): ADTLinkedListState<T> {
		let state: ADTLinkedListState<T> | null = s;

		if (!s) {
			state = this.getDefaultState();
		}

		if (!options) {
			return state;
		}

		if (options.elements && Array.isArray(options.elements)) {
			state.elements = options.elements.slice();
		}

		if (typeof options.objectPool === 'boolean') {
			state.objectPool = options.objectPool;
		}

		return state;
	}

	public getDefaultState(): ADTLinkedListState<T> {
		const state: ADTLinkedListState<T> = {
			type: 'llState',
			elements: [],
			objectPool: false,
			size: 0,
			head: null,
			tail: null
		};

		return state;
	}

	public getStateErrors(state: ADTLinkedListState<T>): Array<string> {
		const errors: Array<string> = [];

		if (!state) {
			errors.push('state is null or undefined');
			return errors;
		}

		if (state.type !== 'llState') {
			errors.push('state type must be llState');
		}

		if (!Array.isArray(state.elements)) {
			errors.push('state elements must be an array');
		}

		// const properties = Object.keys(state.elements[0]);

		// const allSameType = state.elements.every((elem) => {
		// 	return Object.keys(elem).every((key, index) => {
		// 		const sameKeyName = key == properties[index];
		// 		const sameType = typeof key === typeof properties[index];
		// 		return sameKeyName && sameType;
		// 	});
		// });

		// if (!allSameType) {
		// 	errors.push('All elements must be the same type');
		// }

		if (typeof state.objectPool !== 'boolean') {
			errors.push('state objectPool must be a boolean');
		}

		return errors;
	}

	public isPartOfList(node: ADTLinkedListElement<T> | null): boolean {
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

	public queryDelete(query: ADTQueryResult<ADTLinkedListElement<T>>): T | null {
		this.deleteNode(query.element);

		return query.element.value();
	}

	public queryOptions(opts?: ADTQueryOptions): Required<ADTQueryOptions> {
		const options: Required<ADTQueryOptions> = {
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

	public deleteNode(node: ADTLinkedListElement<T> | null): T | null {
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

	public forEach(
		func: (element: ADTLinkedListElement<T>, index: number, arr: ADTLinkedListElement<T>[]) => void,
		thisArg?: any
	): ADTLinkedList<T> {
		const arr = this.getAsArray();

		let boundThis = this;
		if (thisArg) {
			boundThis = thisArg;
		}

		arr.forEach((elem, idx, thisArr) => {
			func.call(boundThis, elem, idx, thisArr);
		});

		return this;
	}

	public getAsArray(): ADTLinkedListElement<T>[] {
		const result: ADTLinkedListElement<T>[] = [];

		let node = this.head();

		while (node) {
			result.push(node);
			node = node.next();
		}

		return result;
	}

	public head(): ADTLinkedListElement<T> | null {
		return this.state.head;
	}

	/**
	 * Alias of insertAtTail for consistency.
	 */
	public insert(element: T): ADTLinkedListElement<T> | null {
		return this.insertAtTail(element);
	}

	/**
	 * Insert element at the front of the list, replacing the current
	 * head if one exists.
	 */
	public insertAtHead(element: T): ADTLinkedListElement<T> | null {
		const node = new ADTLinkedListElement<T>(element);
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
	public insertAtTail(element: T): ADTLinkedListElement<T> {
		const node = new ADTLinkedListElement<T>(element);
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

	public query(
		filters: ADTQueryFilter<T> | ADTQueryFilter<T>[],
		opts?: ADTQueryOptions
	): ADTQueryResult<ADTLinkedListElement<T>>[] {
		const resultsArray: ADTQueryResult<ADTLinkedListElement<T>>[] = [];
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

			const result: ADTQueryResult<ADTLinkedListElement<T>> = {} as ADTQueryResult<
				ADTLinkedListElement<T>
			>;
			result.element = element;
			result.key = () => null;
			result.index = () => null;
			result.delete = this.queryDelete.bind(this, result);
			resultsArray.push(result);
		});

		return resultsArray;
	}

	public reset(): ADTLinkedList<T> {
		this.clearElements();

		this.state.type = 'llState';
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

		const state: ADTLinkedListState<T> = {...this.state};
		state.elements = list;
		state.head = null;
		state.tail = null;

		return JSON.stringify(state);
	}

	/**
	 * Return the tail element if present. Returns null
	 * on empty list.
	 */
	public tail(): ADTLinkedListElement<T> | null {
		return this.state.tail;
	}
}
