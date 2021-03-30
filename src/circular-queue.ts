import {isInteger, isNumber} from './utility';

import {ADTBase} from './base';
import {CircularQueueIterator} from './circular-queue/iterator';
import {ADTCircularQueueOptions as Options} from './circular-queue/options';
import {ADTQueryFilter as QueryFilter} from './query/filter';
import {ADTQueryOptions as QueryOptions} from './query/options';
import {ADTQueryResult as QueryResult} from './query/result';
import {ADTCircularQueueState as State} from './circular-queue/state';

export class ADTCircularQueue<T> implements ADTBase<T> {
	private readonly state: State<T>;

	constructor(options?: Options<T>) {
		this.state = this.parseOptions(options);
	}
	[Symbol.iterator](): CircularQueueIterator<T> {
		return new CircularQueueIterator<T>(this);
	}
	public peek(): T | null {
		return this.front();
	}

	public pop(): T | null {
		if (this.isEmpty()) {
			return null;
		}

		const front = this.front();

		this.state.front = this.wrapIndex(this.state.front + 1);
		this.state.size--;

		return front;
	}

	public push(element: T): boolean {
		if (!this.state.overwrite && this.isFull()) {
			return false;
		}

		this.state.elements[this.state.rear] = element;
		this.state.rear = this.wrapIndex(this.state.rear + 1);

		if (this.state.overwrite && this.isFull()) {
			this.state.front = this.wrapIndex(this.state.front + 1);
		} else {
			this.state.size++;
		}

		return true;
	}

	public front(): T | null {
		if (this.isEmpty()) {
			return null;
		}

		return this.state.elements[this.state.front];
	}

	public rear(): T | null {
		if (this.isEmpty()) {
			return null;
		}

		return this.state.elements[this.wrapIndex(this.state.rear - 1)];
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

	public getIndex(n: number): T | null {
		if (!isInteger(n)) {
			return null;
		}
		if (this.isEmpty()) {
			return null;
		}

		let index = n;
		if (index >= 0) {
			index = this.state.front + index;
		} else {
			index = this.state.rear + index;
		}

		return this.state.elements[this.wrapIndex(index)];
	}

	public filter(func: ArrayMethod<T, boolean>, thisArg?: unknown): ADTCircularQueue<T> {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		let boundThis = this;

		if (thisArg) {
			boundThis = thisArg as this;
		}

		const queue = new ADTCircularQueue<T>({
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

	public forEach(func: ArrayMethod<T, void>, thisArg?: unknown): ADTCircularQueue<T> {
		const front = this.wrapIndex(this.state.front);
		let rear = this.wrapIndex(this.state.rear);

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

	public query(filters: QueryFilter<T> | QueryFilter<T>[], opts?: QueryOptions): QueryResult<T>[] {
		const resultsArray: QueryResult<T>[] = [];
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

			const result: QueryResult<T> = {} as QueryResult<T>;
			result.element = element;
			result.key = (): null => null;
			result.index = this.queryIndex.bind(this, element);
			result.delete = this.queryDelete.bind(this, result);
			resultsArray.push(result);
		});

		return resultsArray;
	}

	public clearElements(): ADTCircularQueue<T> {
		this.state.elements = [];
		this.state.front = 0;
		this.state.rear = 0;
		this.state.size = 0;

		return this;
	}

	public reset(): ADTCircularQueue<T> {
		this.clearElements();

		this.state.type = 'CircularQueue';

		return this;
	}

	public stringify(): string {
		return JSON.stringify(this.state);
	}

	private calculateSize(front: number, rear: number, maxSize: number): number {
		if (front === rear) {
			return 0;
		} else if (front < rear) {
			return rear - front;
		} else {
			return maxSize - (front - rear);
		}
	}

	private wrapIndex(n: number): number {
		let index = n;
		while (index < 0) {
			index += this.state.maxSize;
		}

		return index % this.state.maxSize;
	}

	private parseOptions(options?: Options<T>): State<T> {
		const fromSerial = this.parseOptionsSerialized(options);
		const finalState = this.parseOptionsOverrides(fromSerial, options);

		return finalState;
	}

	private parseOptionsSerialized(options?: Options<T>): State<T> {
		const state: State<T> = this.getDefaultState();

		if (!options) {
			return state;
		}

		let result: State<T> | null = null;

		if (typeof options.serializedState === 'string') {
			const parsed = this.parseSerializedString(options.serializedState);

			if (Array.isArray(parsed)) {
				throw parsed;
			}

			result = parsed;
		}

		if (result) {
			state.elements = result.elements;
			state.overwrite = result.overwrite;
			state.maxSize = result.maxSize;
			state.size = result.size;
			state.front = result.front;
			state.rear = result.rear;
		}

		return state;
	}

	private parseSerializedString(state: string): State<T> | Error[] | null {
		if (typeof state !== 'string' || state === '') {
			return null;
		}

		let result: State<T> | Error[] | null = null;
		let errors: Error[] = [];

		try {
			const parsed = JSON.parse(state);

			if (parsed) {
				errors = this.getStateErrors(parsed);
			}

			if (errors.length || !parsed) {
				throw new Error('state is not a valid ADTCircularQueueState');
			}

			result = parsed;
		} catch (error) {
			result = [error, ...errors];
		}

		return result;
	}

	private parseOptionsOverrides(stateArg: State<T>, options?: Options<T>): State<T> {
		const state: State<T> = stateArg;

		if (!options) {
			return state;
		}

		const errors: Error[] = [];

		if (options.elements != null) {
			const e = this.getStateErrorsElements(options.elements);

			if (e.length) {
				errors.push(...e);
			} else {
				state.elements = options.elements.slice();
			}
		}
		if (options.front != null) {
			const e = this.getStateErrorsFront(options.front);

			if (e.length) {
				errors.push(...e);
			} else {
				state.front = options.front;
			}
		}
		if (options.maxSize != null) {
			const e = this.getStateErrorsMaxSize(options.maxSize);

			if (e.length) {
				errors.push(...e);
			} else {
				state.maxSize = options.maxSize;
			}
		}
		if (options.overwrite != null) {
			const e = this.getStateErrorsOverwrite(options.overwrite);

			if (e.length) {
				errors.push(...e);
			} else {
				state.overwrite = options.overwrite;
			}
		}
		if (options.rear != null) {
			const e = this.getStateErrorsRear(options.rear);

			if (e.length) {
				errors.push(...e);
			} else {
				state.rear = options.rear;
			}
		}
		if (options.size != null) {
			const e = this.getStateErrorsSize(options.size);

			if (e.length) {
				errors.push(...e);
			} else {
				state.size = options.size;
			}
		}

		if (errors.length) {
			throw errors;
		}

		state.size = this.calculateSize(state.front, state.rear, state.maxSize);

		return state;
	}

	private getDefaultState(): State<T> {
		const state: State<T> = {
			type: 'CircularQueue',
			elements: [],
			overwrite: false,
			size: 0,
			maxSize: 100,
			front: 0,
			rear: 0
		};

		return state;
	}

	private getStateErrors(state: State<T>): Error[] {
		const errors: Error[] = [];

		errors.push(...this.getStateErrorsElements(state.elements));
		errors.push(...this.getStateErrorsFront(state.front));
		errors.push(...this.getStateErrorsMaxSize(state.maxSize));
		errors.push(...this.getStateErrorsOverwrite(state.overwrite));
		errors.push(...this.getStateErrorsRear(state.rear));
		errors.push(...this.getStateErrorsSize(state.size));
		errors.push(...this.getStateErrorsType(state.type));

		return errors;
	}

	private getStateErrorsElements(data: unknown): Error[] {
		const errors: Error[] = [];

		if (data == null || !Array.isArray(data)) {
			errors.push(Error('state elements must be an array'));
		}

		return errors;
	}

	private getStateErrorsFront(data: unknown): Error[] {
		const errors: Error[] = [];

		if (data == null || !isInteger(data)) {
			errors.push(Error('state front must be an integer'));
		}

		return errors;
	}

	private getStateErrorsMaxSize(data: unknown): Error[] {
		const errors: Error[] = [];

		if (data == null || !isInteger(data) || data < 1) {
			errors.push(Error('state maxSize must be an integer >= 1'));
		}

		return errors;
	}

	private getStateErrorsOverwrite(data: unknown): Error[] {
		const errors: Error[] = [];

		if (data == null || typeof data !== 'boolean') {
			errors.push(Error('state overwrite must be a boolean'));
		}

		return errors;
	}

	private getStateErrorsRear(data: unknown): Error[] {
		const errors: Error[] = [];

		if (data == null || !isInteger(data)) {
			errors.push(Error('state rear must be an integer'));
		}

		return errors;
	}

	private getStateErrorsSize(data: unknown): Error[] {
		const errors: Error[] = [];

		if (data == null || !isInteger(data) || data < 0) {
			errors.push(Error('state size must be an integer >= 0'));
		}

		return errors;
	}

	private getStateErrorsType(data: unknown): Error[] {
		const errors: Error[] = [];

		if (data == null || data !== 'CircularQueue') {
			errors.push(Error('state type must be CircularQueue'));
		}

		return errors;
	}

	private queryDelete(query: QueryResult<T>): T | null {
		let index = query.index();

		if (index === null) {
			return null;
		}

		const front = this.wrapIndex(this.state.front);
		let rear = this.wrapIndex(this.state.rear);

		if (this.size() && rear <= front) {
			rear = rear + this.state.maxSize;
		}

		if (this.size() && index < front) {
			index = index + this.state.maxSize;
		}

		this.state.elements.splice(this.wrapIndex(index), 1);
		this.state.size--;
		this.state.rear = this.wrapIndex(this.state.rear - 1);

		return query.element;
	}

	private queryIndex(query: T): number | null {
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
}

type ArrayMethod<T, U> = (element: T, index: number, arr: T[]) => U;
