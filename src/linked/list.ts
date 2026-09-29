import type {DataStructure} from '../data/structure';
import type {LinkedListMethod} from './list/method';
import {ElementPool} from '../element/pool';
import {LinkedListElement} from './list/element';
import {LinkedListIterator} from './list/iterator';
import type {LinkedListOptions} from './list/options';
import type {ObjectPoolConstructor} from '../object/pool/constructor';
import type {QueryFilter} from '../query/filter';
import type {QueryOptions} from '../query/options';
import type {QueryResult} from '../query/result';
import {booleanValue} from '../boolean/value';
import {isNumber, undefinedItemSkip} from '../utility';

/** Shared `key()` for every query result. Module level, so no closure per result. */
function queryResultKey(): string | null {
	return null;
}

/** Shared `index()` for every query result. Module level, so no closure per result. */
function queryResultIndex(): number | null {
	return null;
}

/**
 * Doubly linked list. Elements wrap each item and expose `prev()` / `next()`
 * links so callers can walk the list in either direction.
 *
 * Node wrappers are pooled by default (see `DataStructureOptions`). Byte encoding is
 * provided by the `ByteLinkedList` subclass, which requires an `ItemCodec`
 * at construction.
 *
 * @remarks
 * `null` and `undefined` items are not supported, because `null` is the
 * list's own empty-node sentinel: insert methods reject them and return
 * `null` instead of linking a node (an undefined item throws instead when
 * `allowUndefinedItem` is `false`). Use a wrapper item when an "empty" entry
 * must round-trip. A linked node's value can still be set to `null` through
 * the element itself; such nodes count toward `size()` but are skipped by
 * `values()`, `filter()`, `query()`, and `stringify()`.
 *
 * @category Linked List
 */
export class LinkedList<ItemT> implements DataStructure<ItemT> {
	private _head: LinkedListElement<ItemT> | null;
	private _tail: LinkedListElement<ItemT> | null;
	private _size: number;
	/** Last id handed to a linked node. Only increases, so ids never repeat. */
	private lastLinkId: number;
	/** Source of node wrappers, pooled or freshly allocated per options. */
	private readonly elements: ElementPool<LinkedListElement<ItemT>>;
	/** Whether an undefined item is skipped as a no-op or throws. */
	public readonly allowUndefinedItem: boolean;

	/**
	 * @param data		Items inserted head to tail on creation. Any other input
	 * 					is ignored, and null and undefined entries add nothing.
	 * @param options	Optional config. Each option falls back to its default when
	 * 					missing or invalid.
	 */
	constructor(data?: ItemT[] | null, options?: LinkedListOptions<ItemT> | null) {
		this.allowUndefinedItem = booleanValue(true, options?.allowUndefinedItem);
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

	/**
	 * Iterate values head to tail. Each loop creates one iterator; its
	 * `next()` reuses a single result object. `forEach` is the path that
	 * allocates nothing at all.
	 */
	[Symbol.iterator](): LinkedListIterator<ItemT> {
		return new LinkedListIterator<ItemT>(this);
	}

	/**
	 * Insert element at head of list, making provided element
	 * the new Linked List head.
	 *
	 * @param element
	 * @returns		The node wrapping element, or null when element is null or
	 * 				undefined, which are not supported and add nothing.
	 */
	public insertAtHead(element: ItemT): LinkedListElement<ItemT> | null {
		if (undefinedItemSkip(element, this.allowUndefinedItem, 'LinkedList') || element === null) {
			return null;
		}

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

	/**
	 * Insert element at tail of list, making provided element
	 * the new Linked List tail.
	 *
	 * @param element
	 * @returns		The node wrapping element, or null when element is null or
	 * 				undefined, which are not supported and add nothing.
	 */
	public insertAtTail(element: ItemT): LinkedListElement<ItemT> | null {
		if (undefinedItemSkip(element, this.allowUndefinedItem, 'LinkedList') || element === null) {
			return null;
		}

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
	 * Insert each provided element at tail. Null and undefined entries add
	 * nothing, as for `insertAtTail`.
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
		this.drop(node);

		return value;
	}

	/**
	 * Remove each node in array order, as `removeNode` does.
	 * @returns		Removed values that are not null or undefined, in array order.
	 */
	public removeNodes(nodes: Array<LinkedListElement<ItemT> | null>): ItemT[] {
		const deleted: ItemT[] = [];

		for (let i = 0; i < nodes.length; i++) {
			const result = this.removeNode(nodes[i]);
			if (result != null) {
				deleted.push(result);
			}
		}

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
		return {...this.elements.options(), allowUndefinedItem: this.allowUndefinedItem};
	}

	/**
	 * Call func for each element, head to tail, by walking node links directly.
	 * No array of elements is built, so the traversal itself allocates nothing.
	 *
	 * @remarks
	 * Like `Map` / `Set`, func receives the list itself as its third argument,
	 * not an array. func may remove the current element or any other element:
	 * the successor is re-read after func runs while the current element is
	 * still linked, and the one captured before the call is used once it is
	 * not. Removing the current element and its captured successor in the same
	 * call ends the walk. Elements inserted during the walk may or may not be
	 * visited.
	 *
	 * @param func		Called with (element, index, list) walking head to tail.
	 * @param thisArg	Value used as `this` when calling func, as passed. Like
	 * 					`Array.prototype.forEach`, `this` is undefined when omitted.
	 */
	public forEach(func: LinkedListMethod<ItemT, void>, thisArg?: unknown): LinkedList<ItemT> {
		let node = this._head;
		let index = 0;

		while (node !== null && node._list === this) {
			const linkId = node._linkId;
			const next = node.next();
			func.call(thisArg, node, index, this);
			// The fresh successor when func left the current element linked (the
			// same node, per link id, not a recycled reissue), the captured one
			// when func removed it and blanked its links.
			node = node._list === this && node._linkId === linkId ? node.next() : next;
			index++;
		}

		return this;
	}

	public reverse(): LinkedList<ItemT> {
		let curr = this._head;

		if (!curr || this.size() <= 1) {
			return this;
		}

		this._tail = curr;
		let prev: LinkedListElement<ItemT> | null = null;

		while (curr !== null) {
			const next = curr.next();
			curr.next(prev);
			curr.prev(next);

			prev = curr;
			curr = next;
		}

		// prev is the old tail: the new head.
		this._head = prev;

		return this;
	}

	/**
	 * Values of every element, head to tail. Elements whose value is null are
	 * skipped.
	 */
	public values(): ItemT[] {
		const values: ItemT[] = [];
		let node = this._head;

		while (node) {
			const value = node.value();
			if (value !== null) {
				values.push(value);
			}
			node = node.next();
		}

		return values;
	}

	/**
	 * Serialize list values, head to tail, to a JSON string. Elements whose
	 * value is null are skipped, as in `values()`, so the serialized element
	 * count can be smaller than `size()`.
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

	/**
	 * Find elements whose values pass every filter, head to tail. An empty
	 * filter array matches nothing. Elements whose value is null or undefined
	 * never match. Each result's `delete()` removes its element, and does
	 * nothing once that element has been removed some other way.
	 *
	 * @remarks
	 * Allocates only the returned array and one result (plus its bound
	 * `delete`) per match. Elements that do not match allocate nothing.
	 * A filter that removes elements from the list is tolerated the same way
	 * as a `forEach` callback: the walk follows the fresh successor while the
	 * current element is still linked.
	 */
	public query(
		filters: QueryFilter<ItemT> | QueryFilter<ItemT>[],
		opts?: QueryOptions
	): QueryResult<LinkedListElement<ItemT>, ItemT>[] {
		const resultsArray: QueryResult<LinkedListElement<ItemT>, ItemT>[] = [];
		const limit = this.queryLimit(opts);
		let node = this._head;

		// Stops walking as soon as the limit is reached.
		while (node !== null && node._list === this && resultsArray.length < limit) {
			const element = node;
			const linkId = element._linkId;
			const next = element.next();
			const value = element.value();

			if (value != null && this.queryMatch(filters, value)) {
				resultsArray.push({
					element: element,
					key: queryResultKey,
					index: queryResultIndex,
					delete: this.queryDelete.bind(this, element, linkId)
				});
			}

			// The fresh successor when the filters left the current element
			// linked, the captured one when a filter removed it.
			node = element._list === this && element._linkId === linkId ? element.next() : next;
		}

		return resultsArray;
	}

	/**
	 * Unlink and drop every element. Elements removed this way have their
	 * `prev()` / `next()` links cleared, and are recycled when pooling is on.
	 */
	public clearElements(): LinkedList<ItemT> {
		let node = this._head;

		this._head = null;
		this._tail = null;
		this._size = 0;

		// Walks the links and drops each node directly; builds no array.
		while (node) {
			const next = node.next();
			this.drop(node);
			node = next;
		}

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
	 * Blank a node that has left the list and hand it back to the element
	 * pool. With pooling on, release blanks it through `cleanObj()`; with
	 * pooling off, release does nothing, so the node is blanked here. Either
	 * way a removed node no longer holds its item.
	 */
	private drop(node: LinkedListElement<ItemT>): void {
		if (this.elements.enabled()) {
			this.elements.release(node);
		} else {
			node.cleanObj();
		}
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

	/**
	 * Whether value passes every filter. An empty filter array matches
	 * nothing. Plain loop, so no closure is created per element.
	 */
	private queryMatch(filters: QueryFilter<ItemT> | QueryFilter<ItemT>[], value: ItemT): boolean {
		if (!Array.isArray(filters)) {
			return filters(value);
		}

		if (filters.length === 0) {
			return false;
		}

		for (let i = 0; i < filters.length; i++) {
			if (!filters[i](value)) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Maximum number of query results: opts.limit rounded when it is a number
	 * of at least 1, otherwise unlimited.
	 */
	private queryLimit(opts?: QueryOptions): number {
		const limit = opts?.limit;

		if (limit && isNumber(limit) && limit >= 1) {
			return Math.round(limit);
		}

		return Infinity;
	}
}
