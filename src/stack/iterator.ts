import {Stack} from '../stack';
import {type IterableType} from '../iterable/type';
import {type Iterator} from '../iterator';

/**
 * Iterator object used to iterate over Stack elements from top to bottom.
 *
 * @remarks
 * `next()` returns the same result object on every call, updated in place, so
 * iterating allocates nothing beyond the iterator itself. Read `value` before
 * calling `next()` again. `Stack.forEach` allocates nothing at all.
 *
 * @category Stack
 */
export class StackIterator<ItemT> implements Iterator<ItemT | null> {
	/** Number of elements visited so far, counted from the top. */
	private curr: number;
	private stack: Stack<ItemT>;
	/** Reused by every `next()` call. */
	private readonly result: IterableType<ItemT | null>;

	constructor(stack: Stack<ItemT>) {
		this.stack = stack;
		this.curr = 0;
		this.result = {value: null, done: false};
	}

	next(): IterableType<ItemT | null> {
		const size = this.stack.size();
		const result = this.result;

		if (this.curr >= size) {
			result.value = null;
			result.done = true;

			return result;
		}

		result.value = this.stack.at(this.curr);
		result.done = false;
		this.curr++;

		return result;
	}
}
