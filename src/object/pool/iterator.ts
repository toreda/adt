import {ObjectPool} from '../pool';
import type {ObjectPoolInstance} from './instance';
import type {IterableType} from '../../iterable/type';
import type {Iterator} from '../../iterator';

/**
 * Walks the pool's in-use objects. Each iterator reuses one result object for
 * every `next()` call, so a loop allocates only the iterator itself. Use
 * `ObjectPool.forEach` for a loop that allocates nothing. Releasing objects
 * during iteration moves other objects between slots, so collect them first
 * or release from inside `forEach` instead.
 *
 * @category Object Pool
 */
export class ObjectPoolIterator<ItemT extends ObjectPoolInstance> implements Iterator<ItemT | null> {
	private curr: number;
	private readonly op: ObjectPool<ItemT>;
	private readonly result: IterableType<ItemT | null>;

	constructor(op: ObjectPool<ItemT>) {
		this.curr = 0;
		this.op = op;
		this.result = {value: null, done: false};
	}

	public next(): IterableType<ItemT | null> {
		if (this.curr < this.op.state.usedCount) {
			this.result.value = this.op.state.used[this.curr];
			this.result.done = false;
			this.curr++;
		} else {
			this.result.value = null;
			this.result.done = true;
		}

		return this.result;
	}
}
