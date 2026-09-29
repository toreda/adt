import type {CircularQueue} from '../queue';
import {type IterableType} from '../../iterable/type';
import {type Iterator} from '../../iterator';

/**
 * Iterates CircularQueue items from front to rear.
 *
 * @remarks
 * Every `next()` call returns the same result object, updated in place, so
 * iteration allocates only the iterator itself. Read `value` and `done`
 * before the next call; a stored result changes when iteration continues.
 * `CircularQueue.forEach` allocates nothing at all and is the preferred walk
 * on a hot path.
 *
 * @category Circular Queue
 */
export class CircularQueueIterator<ItemT> implements Iterator<ItemT | null> {
	/** Position from the front of the next item to visit. */
	private curr: number;
	private readonly queue: CircularQueue<ItemT>;
	/** Result object reused by every `next()` call. */
	private readonly result: IterableType<ItemT | null>;

	constructor(queue: CircularQueue<ItemT>) {
		this.queue = queue;
		this.curr = 0;
		this.result = {value: null, done: false};
	}

	public next(): IterableType<ItemT | null> {
		const result = this.result;

		if (this.curr >= this.queue.size()) {
			result.value = null;
			result.done = true;
			return result;
		}

		result.value = this.queue.getIndex(this.curr);
		result.done = false;
		this.curr++;

		return result;
	}
}
