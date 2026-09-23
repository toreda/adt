import {Stack} from '../stack';
import {type IterableType} from '../iterable/type';
import {type Iterator} from '../iterator';
import {iterableMakeType} from '../iterable/helpers';

/**
 * Iterator object used to iterate over Stack elements from top to bottom.
 *
 * @category Stack
 */
export class StackIterator<ItemT> implements Iterator<ItemT | null> {
	/** Number of elements visited so far, counted from the top. */
	private curr: number;
	private stack: Stack<ItemT>;

	constructor(stack: Stack<ItemT>) {
		this.stack = stack;
		this.curr = 0;
	}

	next(): IterableType<ItemT | null> {
		const size = this.stack.size();

		if (this.curr >= size) {
			return iterableMakeType(null, true);
		}

		const value = this.stack.state.elements[size - 1 - this.curr];
		this.curr++;

		return iterableMakeType(value, false);
	}
}
