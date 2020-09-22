import ADTCollection from './collection';
import ADTCollectionSelector from './selector';

export default class ADTStack<T> implements ADTCollection<T> {
	public _elements: T[];
	public size: number;
	public _top: number;
	public _bottom: number;

	constructor() {
		this.size = 0;
		this._top = -1;
		this._bottom = 0;
		this._elements = [];
	}

	public push(element: T): ADTStack<T> {
		this._elements.push(element);
		this._top++;
		this.size++;
		return this;
	}

	public pop(): T | null {
		if (!this.size) {
			return null;
		}

		const result = this._elements[this._top];
		this._top--;
		this.size--;

		return result;
	}

	public top(): T | null {
		if (!this.size) {
			return null;
		}

		return this._elements[this._top];
	}

	public bottom(): T | null {
		if (!this.size) {
			return null;
		}

		return this._elements[this._bottom];
	}

	public reverse(): ADTStack<T> {
		if (this.size <= 1) {
			return this;
		}

		this._elements = this._elements.reverse();
		return this;
	}

	public parse(data: string): any | null {
		return null;
	}

	public stringify(): string | null {
		return null;
	}

	public clearElements(): ADTStack<T> {
		this._elements = [];
		this._top = -1;
		this.size = 0;

		return this;
	}

	public reset(): ADTStack<T> {
		this.clearElements();
		this._bottom = 0;

		return this;
	}

	public select(): ADTCollectionSelector<T> {
		const selector = new ADTCollectionSelector<T>(this);

		return selector;
	}
}
