import ADTBase from './base';
import ADTLinkedListElement from './linked-list-element';
import ADTQueryFilter from './query-filter';
import ADTQueryOptions from './query-options';
import ADTQueryResult from './query-result';

export default class ADTLinkedList<T> implements ADTBase<T> {
	public length: number;
	public _head: ADTLinkedListElement<T> | null;
	public _tail: ADTLinkedListElement<T> | null;

	constructor(elements?: T | T[]) {
		this.length = 0;
		this._head = null;
		this._tail = null;

		if (elements) {
			if (Array.isArray(elements)) {
				elements.forEach((element: T) => {
					this.insert(element);
				});
			} else {
				this.insert(elements);
			}
		}
	}

	public head(): ADTLinkedListElement<T> | null {
		return this._head;
	}

	/**
	 * Return the tail element if present. Returns null
	 * on empty list.
	 */
	public tail(): ADTLinkedListElement<T> | null {
		return this._tail;
	}

	/**
	 * Reverse the linked list in place.
	 */
	public reverse(): ADTLinkedList<T> {
		let curr = this._head;

		if (!curr || this.length <= 1) {
			return this;
		}

		let prev = curr.prev();
		this._tail = curr;

		while (curr !== null) {
			const next = curr.next();
			curr.next(prev);
			curr.prev(next);

			if (next === null) {
				this._head = curr;
			}

			prev = curr;
			curr = next;
		}

		return this;
	}

	/**
	 * Insert element at the end of the list.
	 */
	public insert(element: T): ADTLinkedListElement<T> {
		const node = new ADTLinkedListElement<T>(element);

		if (this.length === 0) {
			this._head = node;
			this._tail = node;

			this._head.prev(null);
			this._head.next(null);
		} else {
			const temp = this._tail!;
			temp.next(node);

			node.prev(temp);
			node.next(null);

			this._tail = node;
		}

		++this.length;
		return node;
	}

	/**
	 * Alias of insert for consistency.
	 */
	public insertAtBack(element: T): ADTLinkedListElement<T> | null {
		return this.insert(element);
	}

	/**
	 * Insert element at the front of the list, replacing the current
	 * head if one exists.
	 */
	public insertAtFront(element: T): ADTLinkedListElement<T> | null {
		const node = new ADTLinkedListElement<T>(element);
		if (this.length === 0) {
			this._head = node;
			this._tail = node;

			this._tail.prev(null);
			this._tail.next(null);
		} else {
			const temp = this._head!;
			temp.prev(node);

			node.prev(null);
			node.next(temp);

			this._head = node;
		}

		++this.length;
		return node;
	}

	public forEach(func: (...args) => void): ADTLinkedList<T> {
		let node = this.head();

		while (node) {
			func(node);
			node = node.next();
		}

		return this;
	}

	public getStateErrors(state: Array<T>): Array<string> {
		const errors: Array<string> = [];

		if (!Array.isArray(state)) {
			errors.push('Must be an array');
			return errors;
		}

		if (state.length === 0) {
			return errors;
		}

		const properties = Object.keys(state[0]);

		const allSameType = state.every((elem) => {
			return Object.keys(elem).every((key, index) => {
				const sameKeyName = key == properties[index];
				const sameType = typeof key === typeof properties[index];
				return sameKeyName && sameType;
			});
		});

		if (!allSameType) {
			errors.push('All elements must be the same type');
		}

		return errors;
	}

	public parse(data: string): ADTLinkedList<T> | Array<string> | null {
		if (typeof data !== 'string' || data === '') {
			return null;
		}

		let result: ADTLinkedList<T> | Array<string> | null = null;
		let parsed: Array<T> | null = null;
		let errors: Array<string> = [];

		try {
			parsed = JSON.parse(data);

			if (parsed) {
				errors = this.getStateErrors(parsed);
			}

			if (errors.length) {
				throw new Error('not a valid ADTLinkedList');
			}

			result = new ADTLinkedList<T>(parsed!);
		} catch (error) {
			result = [error.message];
		}

		return result;
	}

	public stringify(): string {
		const list: Array<T> = [];

		if (!this.head() || !this.tail() || this.length === 0) {
			return '[]';
		}

		let curr = this.head();
		while (curr !== null) {
			const value = curr.value();
			if (value !== null) list.push(value);
			curr = curr.next();
		}

		return JSON.stringify(list);
	}

	/**
	 * Remove all elements from the linked list.
	 */
	public clearElements(): ADTLinkedList<T> {
		let curr = this._head;

		while (curr !== null) {
			const next = curr.next();
			curr.prev(null);
			curr.next(null);

			curr = next;
		}

		this._head = null;
		this._tail = null;
		this.length = 0;

		return this;
	}

	public reset(): ADTLinkedList<T> {
		this.clearElements();

		return this;
	}

	public query(
		filters: ADTQueryFilter | ADTQueryFilter[],
		options?: ADTQueryOptions
	): ADTQueryResult<ADTLinkedListElement<T>>[] {
		let result: ADTQueryResult<ADTLinkedListElement<T>>[] = [];

		this.forEach((element) => {
			let skip = true;

			if (Array.isArray(filters)) {
				skip = filters.every((filter) => {
					return filter(element);
				});
			} else {
				skip = filters(element);
			}

			if (skip) {
				return false;
			}

			const res: ADTQueryResult<ADTLinkedListElement<T>> = {} as ADTQueryResult<ADTLinkedListElement<T>>;
			res.element = element;
			res.key = () => null;
			res.index = () => null;
			res.delete = this.queryDelete.bind(this, res);
			result.push(res);
		});

		return result;
	}

	public queryDelete(query: ADTQueryResult<ADTLinkedListElement<T>>): T | null {
		const next = query.element.next();
		const prev = query.element.prev();

		if (next) {
			next.prev(prev);
		}
		if (prev) {
			prev.next(next);
		}

		query.element.next(null);
		query.element.prev(null);

		return query.element.value();
	}
}
