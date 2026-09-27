import type {ADT} from '../adt';
import type {LinkedListMethod} from './list/method';
import {ElementPool} from '../element/pool';
import {LinkedListElement} from './list/element';
import {LinkedListIterator} from './list/iterator';
import type {LinkedListOptions} from './list/options';
import type {ObjectPoolConstructor} from '../object/pool/constructor';
import type {QueryFilter} from '../query/filter';
import type {QueryOptions} from '../query/options';
import type {QueryResult} from '../query/result';
import {isNumber} from '../utility';

/**
 * Doubly linked list. Elements wrap each item and expose `prev()` / `next()`
 * links so callers can walk the list in either direction.
 *
 * Node wrappers are pooled by default (see `ADTOptions`). Byte encoding is
 * provided by the `ByteLinkedList` subclass, which requires an `ItemCodec`
 * at construction.
 *
 * @category Linked List
 */
export class LinkedList<ItemT> implements ADT<ItemT> {
	private _head: LinkedListElement<ItemT> | null;
	private _tail: LinkedListElement<ItemT> | null;
	private _size: number;
	/** Last id handed to a linked node. Only increases, so ids never repeat. */
	private lastLinkId: number;
	/** Source of node wrappers, pooled or freshly allocated per options. */
	private readonly elements: ElementPool<LinkedListElement<ItemT>>;

	/**
	 * @param data		Items inserted head to tail on creation. Any other input is ignored.
	 * @param options	Optional config. Each option falls back to its default when
	 * 					missing or invalid.
	 */
	constructor(data?: ItemT[] | null, options?: LinkedListOptions<ItemT> | null) {
		this._head = null;
		this._tail = null;
		this._size = 0;
		this.lastLinkId = 0;
		// The element class is generic and the pool builds blank nodes with no
		// value, so any ItemT instantiation is valid here.
		this.elements = new ElementPool(
			LinkedListElement as ObjectPoolConstructor<LinkedListElement<ItemT>>,
			options
		);

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
		const node = this.createElement(element);
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
		const node = this.createElement(element);
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

	/**
	 * Unlink node from the list and return its value in O(1). With pooling on,
	 * the node is recycled and must not be used afterwards.
	 * @returns		The removed value, or null when node is null or not part of
	 * 				this list (including a node that was already removed).
	 */
	public removeNode(node: LinkedListElement<ItemT> | null): ItemT | null {
		if (!node || !this.isPartOfList(node)) {
			return null;
		}

		const value = node.value();
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
		this.unlink(node);
		this.elements.release(node);

		return value;
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
	 * returns true, in list order. The new list uses this list's options.
	 * @param func		Called with (element, index, list) walking head to tail.
	 * @param thisArg	Value used as `this` when calling func, as passed. Like
	 * 					`Array.prototype.filter`, `this` is undefined when omitted.
	 */
	public filter(func: LinkedListMethod<ItemT, boolean>, thisArg?: unknown): LinkedList<ItemT> {
		return new LinkedList<ItemT>(this.filterValues(func, thisArg), this.options());
	}

	/**
	 * Values of elements for which func returns true, in list order. Elements
	 * whose value is null are never included. Subclasses build their own
	 * `filter()` result from this.
	 */
	protected filterValues(func: LinkedListMethod<ItemT, boolean>, thisArg?: unknown): ItemT[] {
		const values: ItemT[] = [];

		this.forEach((elem, idx, list) => {
			const result = func.call(thisArg, elem, idx, list);
			const value = elem.value();
			if (result && value != null) {
				values.push(value);
			}
		});

		return values;
	}

	/**
	 * Options equivalent to the ones this list was built with, for creating
	 * derived lists that behave the same way.
	 */
	protected options(): LinkedListOptions<ItemT> {
		return this.elements.options();
	}

	/**
	 * Call func for each element, head to tail, by walking node links directly.
	 * No array of elements is built, so the traversal itself allocates nothing.
	 *
	 * @remarks
	 * Like `Map` / `Set`, func receives the list itself as its third argument,
	 * not an array. Each element's successor is read before func runs, so func
	 * may remove the current element. Elements inserted during the walk may or
	 * may not be visited.
	 *
	 * @param func		Called with (element, index, list) walking head to tail.
	 * @param thisArg	Value used as `this` when calling func, as passed. Like
	 * 					`Array.prototype.forEach`, `this` is undefined when omitted.
	 */
	public forEach(func: LinkedListMethod<ItemT, void>, thisArg?: unknown): LinkedList<ItemT> {
		let node = this._head;
		let index = 0;

		while (node) {
			const next = node.next();
			func.call(thisArg, node, index, this);
			node = next;
			index++;
		}

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
		let node = this._head;

		// Stops walking as soon as the limit is reached.
		while (node && resultsArray.length < options.limit) {
			const element = node;
			const value = element.value();
			node = element.next();

			const take =
				value != null &&
				(Array.isArray(filters)
					? filters.length > 0 && filters.every((filter) => filter(value))
					: filters(value));

			if (!take) {
				continue;
			}

			resultsArray.push({
				element: element,
				key: (): string | null => null,
				index: (): number | null => null,
				delete: this.queryDelete.bind(this, element, element._linkId)
			});
		}

		return resultsArray;
	}

	/**
	 * Unlink and drop every element. Elements removed this way have their
	 * `prev()` / `next()` links cleared, and are recycled when pooling is on.
	 */
	public clearElements(): LinkedList<ItemT> {
		const nodes = this.toArray();

		for (const node of nodes) {
			this.unlink(node);
		}

		this._head = null;
		this._tail = null;
		this._size = 0;
		this.elements.releaseAll(nodes);

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

	/**
	 * Blank node from the element pool, filled with value and claimed by this
	 * list under a fresh link id. The caller links it into place.
	 */
	private createElement(value: ItemT): LinkedListElement<ItemT> {
		const node = this.elements.allocate();
		node.value(value);
		node._list = this;
		node._linkId = ++this.lastLinkId;

		return node;
	}

	/**
	 * Clear node's links and ownership. Needed even when pooling is off, where
	 * release does not blank the node.
	 */
	private unlink(node: LinkedListElement<ItemT>): void {
		node.prev(null);
		node.next(null);
		node._list = null;
		node._linkId = 0;
	}

	private isPartOfList(node: LinkedListElement<ItemT>): boolean {
		return node._list === this;
	}

	/**
	 * Remove a query match, but only while element still holds the item it
	 * matched. A recycled element reissued to a later insert carries a new
	 * link id, so a stale result deletes nothing instead of the new item.
	 */
	private queryDelete(element: LinkedListElement<ItemT>, linkId: number): ItemT | null {
		if (element._linkId !== linkId) {
			return null;
		}

		return this.removeNode(element);
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
