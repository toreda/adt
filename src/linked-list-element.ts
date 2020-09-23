import ADTBaseElement from './base-element';

export default class ADTLinkedListElement<T> implements ADTBaseElement<T> {
	private _value: T | null;
	public _next: ADTLinkedListElement<T> | null;
	public _prev: ADTLinkedListElement<T> | null;

	constructor(element?: T) {
		this._next = null;
		this._prev = null;

		if (typeof element !== 'undefined') {
			this._value = element;
		} else {
			this._value = null;
		}
	}

	public value(elementValue?: T): T | null {
		if (typeof elementValue === 'undefined') {
			return this._value;
		}

		this._value = elementValue;
		return null;
	}

	public prev(element?: ADTLinkedListElement<T>|null): ADTLinkedListElement<T> | null {
		if (typeof element === 'undefined') {
			return this._prev;
		}

		this._prev = element;
		return null;
	}

	public next(element?: ADTLinkedListElement<T>|null): ADTLinkedListElement<T> | null {
		if (typeof element === 'undefined') {
			return this._next;
		}

		this._next = element;
		return null;
	}
}
