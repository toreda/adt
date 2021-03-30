import {ADTCircularQueue} from '../circular-queue';
import {IterableType} from '../iterable-type';
import {Iterator} from '../iterator';

export class CircularQueueIterator<ItemT> implements Iterator<ItemT | null> {
	private curr: number;
	private circularQueue: ADTCircularQueue<ItemT>;

	constructor(cq: ADTCircularQueue<ItemT>) {
		this.circularQueue = cq;
		this.curr = 0;
	}

	next(): IterableType<ItemT | null> {
		if (this.circularQueue.isEmpty() || this.curr >= this.circularQueue.size()) {
			return {
				value: null,
				done: true
			};
		}
		const value = this.circularQueue.getIndex(this.curr);
		this.curr++;
		return {value: value, done: false};
	}
}
