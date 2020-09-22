import ADTCollection from './collection';
import {ADTCollectionQuery} from './query';
import ADTCollectionSelector from './selector';
import ADTLinkedListElement from './linked-list-element';

export default class ADTLinkedList<T> implements ADTCollection<T> {
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
		if (this.length <= 1) {
			return this;
		}

		let prev = null;
		let curr = this._head;
		this._tail = curr;

		while (curr !== null) {
			const next = curr.next();
			curr.next(prev);
			curr.prev(next);

			if (next === null) {
				this._head = curr;
			}

			curr = next;
		}

		return this;
	}

	/**
	 * Insert element at the end of the list.
	 */
	public insert(element: T): ADTLinkedListElement<T> {
		const node = new ADTLinkedListElement<T>(element);

		if (this._head === null) {
			this._head = node;
			this._tail = node;
			this._head.prev(null);
			this._head.next(null);
		} else {
			const tmp = this._tail;
			this._tail = node;
			this._tail.next(tmp);
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
		if (this._head === null) {
			this._head = node;
			this._tail = node;
		} else {
			const tmp = this._head;
			tmp.prev(node);
			node.next(tmp);
			this._head = node;
		}

		++this.length;
		return node;
	}

	public parse(data: string): any | null {
		return null;
	}

	public stringify(): string | null {
		return null;
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

	public select(query?: ADTCollectionQuery): ADTCollectionSelector<T> {
		const selector = new ADTCollectionSelector<ADTLinkedListElement<T>>(this, query);

		return selector;
	}
}
