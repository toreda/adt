import {Element} from '../../element';

/**
 * @category LinkedList
 */
export class LinkedListElement<T> implements Element<T> {
	private _value: T | null;
	public _next: LinkedListElement<T> | null;
	public _prev: LinkedListElement<T> | null;

	constructor(element: T) {
		this._next = null;
		this._prev = null;
		this._value = element;
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
