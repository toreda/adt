import {ArmorCollectionElement} from './collection-element';

export class ArmorLinkedListElement<T> implements ArmorCollectionElement<T> {
	private _value: T | null;
	public _next: ArmorLinkedListElement<T> | null;
	public _prev: ArmorLinkedListElement<T> | null;

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

	public prev(element?: ArmorLinkedListElement<T>|null): ArmorLinkedListElement<T> | null {
		if (typeof element === 'undefined') {
			return this._prev;
		}

		this._prev = element;
		return null;
	}

	public next(element?: ArmorLinkedListElement<T>|null): ArmorLinkedListElement<T> | null {
		if (typeof element === 'undefined') {
			return this._next;
		}

		this._next = element;
		return null;
	}
}
