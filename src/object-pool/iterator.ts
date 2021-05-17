import {ADTObjectPool} from '../object-pool';
import {ADTObjectPoolInstance} from './instance';
import {IterableType} from '../iterable-type';
import {Iterator} from '../iterator';
import {makeIterableType} from '../makeIterableType';

export class ObjectPoolIterator<ItemT extends ADTObjectPoolInstance> implements Iterator<ItemT | null> {
	private curr: number;
	private op: ADTObjectPool<ItemT>;

	constructor(op: ADTObjectPool<ItemT>) {
		this.curr = 0;
		this.op = op;
	}

	public next(): IterableType<ItemT | null> {
		if (!this.op.size() || this.curr >= this.op.size()) {
			return makeIterableType(null, true);
		}

		const value = this.op.state.pool[this.curr];
		const done = this.curr === this.op.size() ? true : false;
		this.curr++;

		return makeIterableType(value, done);
	}
}
