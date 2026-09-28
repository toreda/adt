import {ObjectPool} from '../pool.js';
import {ObjectPoolInstance} from './instance.js';
import {IterableType} from '../../iterable/type.js';
import {Iterator} from '../../iterator.js';
import {iterableMakeType} from '../../iterable/helpers.js';

/**
 * @category Object Pool
 */
export class ObjectPoolIterator<ItemT extends ObjectPoolInstance> implements Iterator<ItemT | null> {
	private curr: number;
	private op: ObjectPool<ItemT>;

	constructor(op: ObjectPool<ItemT>) {
		this.curr = 0;
		this.op = op;
	}

	public next(): IterableType<ItemT | null> {
		if (!this.op.size() || this.curr >= this.op.size()) {
			return iterableMakeType(null, true);
		}

		const value = this.op.state.pool[this.curr];
		const done = this.curr === this.op.size() ? true : false;
		this.curr++;

		return iterableMakeType(value, done);
	}
}
