import {ADTQueue} from '../queue';
import {IterableType} from '../iterable-type';
import {Iterator} from '../iterator';
import {makeIterableType} from '../makeIterableType';

export class QueueIterator<ItemT> implements Iterator<ItemT | null> {
	public curr: number;
	public readonly queue: ADTQueue<ItemT>;

	constructor(queue: ADTQueue<ItemT>) {
		this.queue = queue;
		this.curr = 0;
	}

	next(): IterableType<ItemT | null> {
		if (!this.queue.size() || this.curr >= this.queue.size()) {
			return makeIterableType<ItemT | null>(null, true);
		}

		const value = this.queue.state.elements[this.curr];
		const done = this.curr === this.queue.size() - 1 ? true : false;
		this.curr++;

		return makeIterableType<ItemT | null>(value, done);
	}
}
