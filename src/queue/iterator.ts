import {ADTQueue} from '../queue';
import {IterableType} from '../iterable-type';
import {Iterator} from '../iterator';

export class QueueIterator<ItemT> implements Iterator<ItemT | null> {
	public curr: number;
	public readonly queue: ADTQueue<ItemT>;

	constructor(queue: ADTQueue<ItemT>) {
		this.queue = queue;
		this.curr = 0;
	}
	next(): IterableType<ItemT | null> {
		if (!this.queue.size() || this.curr >= this.queue.size()) {
			return {
				value: null,
				done: true
			};
		}
		const value = this.queue.state.elements[this.curr];
		this.curr++;
		return {value: value, done: false};
	}
}
