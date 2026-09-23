import type {ADT} from '../adt';
import type {ArrayMethod} from '../array/method';
import {LinkedListElement} from './list/element';
import {LinkedListIterator} from './list/iterator';
import type {LinkedListOptions} from './list/options';
import type {QueryFilter} from '../query/filter';
import type {QueryOptions} from '../query/options';
import type {QueryResult} from '../query/result';
import {isNumber} from '../utility';

/**
 * Doubly linked list. Elements wrap each item and expose `prev()` / `next()`
 * links so callers can walk the list in either direction.
 *
 * Byte encoding is provided by the `ByteLinkedList` subclass, which requires
 * an `ItemCodec` at construction.
 *
 * @category Linked List
 */
export class LinkedList<ItemT> implements ADT<ItemT> {
	private _head: LinkedListElement<ItemT> | null;
	private _tail: LinkedListElement<ItemT> | null;
	private _size: number;

	/**
	 * @param data		Items inserted head to tail on creation. Any other input is ignored.
	 * @param options	Optional config. Each option falls back to its default when
	 * 					missing or invalid.
	 */
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	constructor(data?: ItemT[] | null, options?: LinkedListOptions<ItemT> | null) {
		this._head = null;
		this._tail = null;
		this._size = 0;

		if (Array.isArray(data)) {
			this.insertArray(data);
		}
	}

	[Symbol.iterator](): LinkedListIterator<ItemT> {
		return new LinkedListIterator<ItemT>(this);
	}

	/**
	 * Insert element at head of list, making provided element
	 * the new Linked List head.
	 *
	 * @param element
	 * @returns
	 */
	public insertAtHead(element: ItemT): LinkedListElement<ItemT> | null {
		const node = new LinkedListElement<ItemT>(element);
		const head = this.head();

		if (!head) {
			this._head = node;
			this._tail = node;

			node.prev(null);
			node.next(null);
		} else {
			head.prev(node);

			node.prev(null);
			node.next(head);

			this._head = node;
		}

		++this._size;
		return node;
	}

	public insertAtTail(element: ItemT): LinkedListElement<ItemT> {
		const node = new LinkedListElement<ItemT>(element);
		const tail = this.tail();

		if (!tail) {
			this._head = node;
			this._tail = node;

			node.prev(null);
			node.next(null);
		} else {
			tail.next(node);

			node.prev(tail);
			node.next(null);

			this._tail = node;
		}

		++this._size;
		return node;
	}

	/**
	 * Alias of insertAtTail.
	 */
	public insert(element: ItemT): LinkedListElement<ItemT> | null {
		return this.insertAtTail(element);
	}

	/**
	 * Insert each provided element at tail.
	 *
	 * @param elements
	 * @returns
	 */
	public insertArray(elements?: ItemT[] | null): void {
		if (!Array.isArray(elements)) {
			return;
		}

		for (const element of elements) {
			this.insertAtTail(element);
		}
	}

	public removeNode(node: LinkedListElement<ItemT> | null): ItemT | null {
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
			this._head = next;
		}
		if (node === this.tail()) {
			this._tail = prev;
		}

		this._size--;
		node.next(null);
		node.prev(null);

		return node.value();
	}

	public removeNodes(nodes: Array<LinkedListElement<ItemT> | null>): ItemT[] {
		const deleted: ItemT[] = [];

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
	public head(): LinkedListElement<ItemT> | null {
		return this._head;
	}

	/**
	 * Get last element in Linked List if one exists.
	 *
	 * @returns 			Returns last element when list length is >= 1.
	 * 						Returns null when list is empty.
	 */
	public tail(): LinkedListElement<ItemT> | null {
		return this._tail;
	}

	/**
	 * Get number of elements in Linked List.
	 * @returns				List size as a positive integer, or 0 if empty.
	 */
	public size(): number {
		return this._size;
	}

	/**
	 * Quickly check whether list has elements.
	 * @returns
	 */
	public isEmpty(): boolean {
		return this._size === 0;
	}

	/**
	 * Create a new list containing only the values of elements for which func
	 * returns true, in list order.
	 * @param func		Called with (element, index, arr) walking head to tail.
	 * @param thisArg	Value used as `this` when calling func. Defaults to this list.
	 */
	public filter(
		func: ArrayMethod<LinkedListElement<ItemT>, boolean>,
		thisArg?: unknown
	): LinkedList<ItemT> {
		return new LinkedList<ItemT>(this.filterValues(func, thisArg));
	}

	/**
	 * Values of elements for which func returns true, in list order. Elements
	 * whose value is null are never included. Subclasses build their own
	 * `filter()` result from this.
	 */
	protected filterValues(func: ArrayMethod<LinkedListElement<ItemT>, boolean>, thisArg?: unknown): ItemT[] {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		let boundThis = this;

		if (thisArg) {
			boundThis = thisArg as this;
		}

		const values: ItemT[] = [];

		this.forEach((elem, idx, arr) => {
			const result = func.call(boundThis, elem, idx, arr);
			const value = elem.value();
			if (result && value != null) {
				values.push(value);
			}
		}, boundThis);

		return values;
	}

	public forEach(func: ArrayMethod<LinkedListElement<ItemT>, void>, thisArg?: unknown): LinkedList<ItemT> {
		const arr = this.toArray();

		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const boundThis = (thisArg ? thisArg : this) as this;

		arr.forEach((elem, idx, thisArr) => {
			func.call(boundThis, elem, idx, thisArr);
		});

		return this;
	}

	public reverse(): LinkedList<ItemT> {
		let curr = this._head;

		if (!curr || this.size() <= 1) {
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
	 * Values of every element, head to tail. Elements whose value is null are
	 * skipped.
	 */
	public values(): ItemT[] {
		const values: ItemT[] = [];

		this.forEach((element) => {
			const value = element.value();
			if (value !== null) {
				values.push(value);
			}
		});

		return values;
	}

	/**
	 * Serialize list values, head to tail, to a JSON string.
	 * @returns		JSON string, or null when a value cannot be serialized
	 * 				(e.g. values contain circular references or BigInt values).
	 */
	public stringify(): string | null {
		try {
			return JSON.stringify({type: 'LinkedList', elements: this.values()});
		} catch {
			return null;
		}
	}

	public toArray(): LinkedListElement<ItemT>[] {
		const result: LinkedListElement<ItemT>[] = [];

		let node = this.head();

		while (node) {
			result.push(node);
			node = node.next();
		}

		return result;
	}

	public query(
		filters: QueryFilter<ItemT> | QueryFilter<ItemT>[],
		opts?: QueryOptions
	): QueryResult<LinkedListElement<ItemT>, ItemT>[] {
		const resultsArray: QueryResult<LinkedListElement<ItemT>, ItemT>[] = [];
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

			const result: QueryResult<LinkedListElement<ItemT>, ItemT> = {} as QueryResult<
				LinkedListElement<ItemT>,
				ItemT
			>;
			result.element = element;
			result.key = (): string | null => null;
			result.index = (): number | null => null;
			result.delete = this.queryDelete.bind(this, result);
			resultsArray.push(result);
		});

		return resultsArray;
	}

	/**
	 * Unlink and drop every element. Elements removed this way have their
	 * `prev()` / `next()` links cleared.
	 */
	public clearElements(): LinkedList<ItemT> {
		this.forEach((element) => {
			element.prev(null);
			element.next(null);
		});

		this._head = null;
		this._tail = null;
		this._size = 0;

		return this;
	}

	/**
	 * Restore the list to its freshly constructed state. Constructor options
	 * are kept.
	 */
	public reset(): LinkedList<ItemT> {
		this.clearElements();

		return this;
	}

	private isPartOfList(node: LinkedListElement<ItemT>): boolean {
		let result = false;

		this.forEach((elem) => {
			if (elem === node) {
				result = true;
			}
		});

		return result;
	}

	private queryDelete(query: QueryResult<LinkedListElement<ItemT>, ItemT>): ItemT | null {
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
