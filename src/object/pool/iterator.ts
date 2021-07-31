import {ObjectPool} from '../pool';
import {ObjectPoolInstance} from './instance';
import {IterableType} from '../../iterable/type';
import {Iterator} from '../../iterator';
import {iterableMakeType} from '../../iterable/helpers';

/**
 * @category ObjectPool
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
