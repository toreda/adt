import {CircularQueue} from '../queue';
import {IterableType} from '../../iterable/type';
import {Iterator} from '../../iterator';
import {iterableMakeType} from '../../iterable/helpers';

/**
 * @category Circular Queue
 */
export class CircularQueueIterator<ItemT> implements Iterator<ItemT | null> {
	private curr: number;
	private circularQueue: CircularQueue<ItemT>;

	constructor(cq: CircularQueue<ItemT>) {
		this.circularQueue = cq;
		this.curr = 0;
	}

	public next(): IterableType<ItemT | null> {
		if (this.circularQueue.isEmpty() || this.curr >= this.circularQueue.size()) {
			return iterableMakeType(null, true);
		}

		const value = this.circularQueue.getIndex(this.curr);
		const done = this.curr === this.circularQueue.size() ? true : false;
		this.curr++;

		return iterableMakeType(value, done);
	}
}
