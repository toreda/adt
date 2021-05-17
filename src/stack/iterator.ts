import {ADTStack} from '../stack';
import {IterableType} from '../iterable-type';
import {Iterator} from '../iterator';
import {makeIterableType} from '../makeIterableType';

export class StackIterator<ItemT> implements Iterator<ItemT | null> {
	private curr: number;
	private stack: ADTStack<ItemT>;

	constructor(stack: ADTStack<ItemT>) {
		this.stack = stack;
		this.curr = 0;
	}

	next(): IterableType<ItemT | null> {
		if (this.stack.isEmpty() || this.curr >= this.stack.size()) {
			return makeIterableType(null, true);
		}

		const value = this.stack.state.elements[this.curr];
		const done = this.curr === this.stack.size() ? true : false;
		this.curr++;

		return makeIterableType(value, done);
	}
}
