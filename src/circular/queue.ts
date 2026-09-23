import {isInteger, isNumber} from '../utility';

import type {ADT} from '../adt';
import type {ArrayMethod} from '../array/method';
import {CircularQueueIterator} from './queue/iterator';
import {CircularQueueState} from './queue/state';
import {type CircularQueueOptions as Options} from './queue/options';
import {type QueryFilter} from '../query/filter';
import {type QueryOptions} from '../query/options';
import {type QueryResult} from '../query/result';

/**
 * Circular Queue data with user defined element types via generics. Implements
 * `ADT` the standard set of interface methods
 *
 * @category Circular Queue
 */
export class CircularQueue<ItemT> implements ADT<ItemT> {
	public readonly state: CircularQueueState<ItemT>;

	constructor(options?: Options<ItemT>) {
		this.state = new CircularQueueState(options);
	}

	[Symbol.iterator](): CircularQueueIterator<ItemT> {
		return new CircularQueueIterator<ItemT>(this);
	}

	/**
	 * Get the first element without removing it, if one exists.
	 * @returns
	 */
	public peek(): ItemT | null {
		return this.front();
	}

	/**
	 * Get the first element and remove it from queue. Returns null and has
	 * no effect when queue is empty.
	 * @returns
	 */
	public pop(): ItemT | null {
		if (this.isEmpty()) {
			return null;
		}

		const front = this.front();

		this.state.frontNdx = this.wrapIndex(this.state.frontNdx + 1);
		this.state.size--;

		return front;
	}

	/**
	 * Push element onto the end of queue.
	 * @param element
	 * @returns
	 */
	public push(...elements: ItemT[]): boolean {
		for (const element of elements) {
			if (!this.state.overwrite && this.isFull()) {
				return false;
			}

			this.state.elements[this.state.rearNdx] = element;
			this.state.rearNdx = this.wrapIndex(this.state.rearNdx + 1);

			if (this.state.overwrite && this.isFull()) {
				this.state.frontNdx = this.wrapIndex(this.state.frontNdx + 1);
			} else {
				this.state.size++;
			}
		}

		return true;
	}

	/**
	 * Insert element at the front of the queue.
	 * @param element
	 * @returns
	 */
	public insertFront(...elements: ItemT[]): boolean {
		for (const element of elements) {
			if (!this.state.overwrite && this.isFull()) {
				return false;
			}

			this.state.frontNdx = this.wrapIndex(this.state.frontNdx - 1);
			this.state.elements[this.state.frontNdx] = element;

			if (this.state.overwrite && this.isFull()) {
				this.state.rearNdx = this.wrapIndex(this.state.rearNdx - 1);
			} else {
				this.state.size++;
			}
		}
		return true;
	}

	/**
	 * Get element currently at the front of the queue, or `null`
	 * if the queue is empty.
	 */
	public front(): ItemT | null {
		if (this.isEmpty()) {
			return null;
		}

		return this.state.elements[this.state.frontNdx];
	}

	public rear(): ItemT | null {
		if (this.isEmpty()) {
			return null;
		}

		return this.state.elements[this.wrapIndex(this.state.rearNdx - 1)];
	}

	public size(): number {
		return this.state.size;
	}

	public isEmpty(): boolean {
		return this.state.size === 0;
	}

	public isFull(): boolean {
		return this.state.size >= this.state.maxSize;
	}

	public getIndex(n: number): ItemT | null {
		if (!isInteger(n)) {
			return null;
		}
		if (this.isEmpty()) {
			return null;
		}

		let index = n;
		if (index >= 0) {
			index = this.state.frontNdx + index;
		} else {
			index = this.state.rearNdx + index;
		}

		return this.state.elements[this.wrapIndex(index)];
	}

	public filter(func: ArrayMethod<ItemT, boolean>, thisArg?: unknown): CircularQueue<ItemT> {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		let boundThis = this;

		if (thisArg) {
			boundThis = thisArg as this;
		}

		const queue = new CircularQueue<ItemT>({
			overwrite: this.state.overwrite,
			maxSize: this.state.maxSize
		});

		this.forEach((elem, idx, arr) => {
			const result = func.call(boundThis, elem, idx, arr);
			if (result) {
				queue.push(elem);
			}
		}, boundThis);

		return queue;
	}

	public forEach(func: ArrayMethod<ItemT, void>, thisArg?: unknown): CircularQueue<ItemT> {
		const front = this.wrapIndex(this.state.frontNdx);
		let rear = this.wrapIndex(this.state.rearNdx);

		if (this.size() && rear <= front) {
			rear = rear + this.state.maxSize;
		}

		// eslint-disable-next-line @typescript-eslint/no-this-alias
		let boundThis = this;

		if (thisArg) {
			boundThis = thisArg as this;
		}

		for (let i = front; i < rear; i++) {
			const iWrap = this.wrapIndex(i);
			func.call(boundThis, this.state.elements[iWrap], iWrap, this.state.elements);
		}

		return this;
	}

	public query(
		filters: QueryFilter<ItemT> | QueryFilter<ItemT>[],
		opts?: QueryOptions
	): QueryResult<ItemT>[] {
		const resultsArray: QueryResult<ItemT>[] = [];
		const options = this.queryOptions(opts);

		this.forEach((element) => {
			let take = false;

			if (resultsArray.length >= options.limit) {
				return false;
			}

			if (Array.isArray(filters)) {
				take =
					!!filters.length &&
					filters.every((filter) => {
						return filter(element);
					});
			} else {
				take = filters(element);
			}

			if (!take) {
				return false;
			}

			const result: QueryResult<ItemT> = {} as QueryResult<ItemT>;
			result.element = element;
			result.key = (): null => null;
			result.index = this.queryIndex.bind(this, element);
			result.delete = this.queryDelete.bind(this, result);
			resultsArray.push(result);
		});

		return resultsArray;
	}

	public clearElements(): CircularQueue<ItemT> {
		this.state.elements.length = 0;
		this.state.frontNdx = 0;
		this.state.rearNdx = 0;
		this.state.size = 0;

		return this;
	}

	public reset(): CircularQueue<ItemT> {
		this.clearElements();

		return this;
	}

	public stringify(): string {
		return JSON.stringify(this.state);
	}

	private wrapIndex(n: number): number {
		let index = n;
		while (index < 0) {
			index += this.state.maxSize;
		}

		return index % this.state.maxSize;
	}

	private queryDelete(query: QueryResult<ItemT>): ItemT | null {
		const index = query.index();

		if (index === null) {
			return null;
		}

		// Splice cannot be used here: it renumbers the physical slots of every
		// element after the removal point while frontNdx/rearNdx stay absolute,
		// which corrupts the queue once it has wrapped. Close the gap by shifting
		// each later element one slot toward the front, following the ring.
		let curr = this.wrapIndex(index);
		let next = this.wrapIndex(curr + 1);
		const rear = this.wrapIndex(this.state.rearNdx);

		while (next !== rear) {
			this.state.elements[curr] = this.state.elements[next];
			curr = next;
			next = this.wrapIndex(next + 1);
		}

		this.state.rearNdx = this.wrapIndex(this.state.rearNdx - 1);
		this.state.size--;

		return query.element;
	}

	private queryIndex(query: ItemT): number | null {
		let position = -1;

		this.forEach((element, index) => {
			if (position !== -1) {
				return false;
			}
			if (element === query) {
				position = index;
			}
		});

		if (position < 0) {
			return null;
		}

		return position;
	}

	private queryOptions(opts?: QueryOptions): Required<QueryOptions> {
		const options: Required<QueryOptions> = {
			limit: Infinity
		};

		if (opts?.limit && isNumber(opts.limit) && opts.limit >= 1) {
			options.limit = Math.round(opts.limit);
		}

		return options;
	}

	public toBinary(): Uint8Array | null {
		return null;
	}
}
