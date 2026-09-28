import type {Element} from '../../element';
import type {LinkedList} from '../list';
import {type ObjectPoolInstance} from '../../object/pool/instance';

/**
 * Node wrapping one item in a `LinkedList`. Implements `ObjectPoolInstance`
 * so the list can recycle nodes through an internal `ObjectPool`.
 *
 * @category Linked List
 */
export class LinkedListElement<T> implements Element<T>, ObjectPoolInstance {
	private _value: T | null = null;
	public _next: LinkedListElement<T> | null = null;
	public _prev: LinkedListElement<T> | null = null;
	/**
	 * List this node is currently linked into, or null when unlinked. Managed
	 * by `LinkedList` only; lets it check ownership in O(1).
	 */
	public _list: LinkedList<T> | null = null;
	/**
	 * Id of the insert that linked this node, unique within `_list`, or 0 when
	 * unlinked. Managed by `LinkedList` only. A recycled node gets a new id, so
	 * a handle that captured the old one can tell the node was reissued.
	 */
	public _linkId: number = 0;

	/**
	 * @param element	Initial value. Omitted when constructed by an `ObjectPool`,
	 * 					which hands out blank nodes for the list to fill.
	 */
	constructor(element?: T) {
		if (element !== undefined) {
			this._value = element;
		}
	}

	/**
	 * Reset every field to its blank state. Called by `ObjectPool` on release
	 * so a recycled node never carries a previous item or its links. Any new
	 * field added to this class must be cleared here.
	 */
	public cleanObj(): void {
		this._value = null;
		this._next = null;
		this._prev = null;
		this._list = null;
		this._linkId = 0;
	}

	public value(elementValue?: T): T | null {
		if (typeof elementValue === 'undefined') {
			return this._value;
		}

		this._value = elementValue;
		return null;
	}

	public prev(element?: LinkedListElement<T> | null): LinkedListElement<T> | null {
		if (typeof element === 'undefined') {
			return this._prev;
		}

		this._prev = element;
		return null;
	}

	public next(element?: LinkedListElement<T> | null): LinkedListElement<T> | null {
		if (typeof element === 'undefined') {
			return this._next;
		}

		this._next = element;
		return null;
	}
}
