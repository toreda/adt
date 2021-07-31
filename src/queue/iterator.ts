import {Queue} from '../queue';
import {IterableType} from '../iterable-type';
import {Iterator} from '../iterator';
import {makeIterableType} from '../makeIterableType';

/**
 * @category Queue
 */
export class QueueIterator<ItemT> implements Iterator<ItemT | null> {
	public curr: number;
	public readonly queue: Queue<ItemT>;

	constructor(queue: Queue<ItemT>) {
		this.queue = queue;
		this.curr = 0;
	}

	next(): IterableType<ItemT | null> {
		if (!this.queue.size() || this.curr >= this.queue.size()) {
			return makeIterableType(null, true);
		}

		const value = this.queue.state.elements[this.curr];
		const done = this.curr === this.queue.size() ? true : false;
		this.curr++;

		return makeIterableType(value, done);
	}
}
