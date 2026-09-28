import type {CircularQueue} from '../queue.js';
import {type IterableType} from '../../iterable/type.js';
import {type Iterator} from '../../iterator.js';
import {iterableMakeType} from '../../iterable/helpers.js';

/**
 * Iterates CircularQueue items from front to rear.
 *
 * @category Circular Queue
 */
export class CircularQueueIterator<ItemT> implements Iterator<ItemT | null> {
	/** Position from the front of the next item to visit. */
	private curr: number;
	private readonly queue: CircularQueue<ItemT>;

	constructor(queue: CircularQueue<ItemT>) {
		this.queue = queue;
		this.curr = 0;
	}

	public next(): IterableType<ItemT | null> {
		if (this.curr >= this.queue.size()) {
			return iterableMakeType(null, true);
		}

		const value = this.queue.getIndex(this.curr);
		this.curr++;

		return iterableMakeType(value, false);
	}
}
