import {Stack} from '../stack';
import {type IterableType} from '../iterable/type';
import {type Iterator} from '../iterator';
import {iterableMakeType} from '../iterable/helpers';

/**
 * Iterator object used to iterate over Stack elements. 
 * 
 * @category Stack
 */
export class StackIterator<ItemT> implements Iterator<ItemT | null> {
	private curr: number;
	private stack: Stack<ItemT>;

	constructor(stack: Stack<ItemT>) {
		this.stack = stack;
		this.curr = 0;
	}

	next(): IterableType<ItemT | null> {
		if (this.stack.isEmpty() || this.curr >= this.stack.size()) {
			return iterableMakeType(null, true);
		}

		const value = this.stack.state.elements[this.curr];
		const done = this.curr === this.stack.size() ? true : false;
		this.curr++;

		return iterableMakeType(value, done);
	}
}
