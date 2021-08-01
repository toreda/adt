import {isInteger, isNumber} from '../utility';

import {ADT} from '../adt';
import {ObjectPoolConstructor as Constructor} from './pool/constructor';
import {ObjectPoolInstance as Instance} from './pool/instance';
import {ObjectPoolIterator} from './pool/iterator';
import {ObjectPoolOptions as Options} from './pool/options';
import {QueryFilter} from '../query/filter';
import {QueryOptions} from '../query/options';
import {QueryResult} from '../query/result';
import {ObjectPoolState as State} from './pool/state';

/**
 *
 * @category Object Pool
 */
export class ObjectPool<T extends Instance> implements ADT<T> {
	public readonly state: State<T>;
	private readonly objectClass: Constructor<T>;
	private wastedSpace: number = 0;

	constructor(objectClass: Constructor<T>, options?: Options) {
		if (typeof objectClass !== 'function') {
			throw Error('Must have a class contructor for object pool to operate properly');
		}

		this.objectClass = objectClass;

		this.state = this.parseOptions(options);

		this.increaseCapacity(this.state.startSize);
	}

	[Symbol.iterator](): ObjectPoolIterator<T> {
		return new ObjectPoolIterator<T>(this);
	}

	/**
	 * Allocate a single object instance. Pool size will increase when
	 * no instances are available for allocation, unless the pool is
	 * already at it's maximum size defined by ObjectPool's config.
	 * @returns				Object instance of type T if available.
	 *						null when an instance can't be allocated.
	 */
	public allocate(): T | null {
		if (this.state.autoIncrease && this.isAboveThreshold(1)) {
			const maxSize = Math.ceil(this.state.objectCount * this.state.increaseFactor) || 1;
			this.increaseCapacity(maxSize - this.state.objectCount);
		}

		const result = this.state.pool.pop();

		if (result == null) {
			return null;
		}

		this.state.used.push(result);

		return result;
	}

	/**
	 * Allocate multiple object instances from pool in a single call. Pool
	 * size will increase to add more instances if no object instances are
	 * available, unless pool has reached it's maximum size as defined by
	 * the ObjectPool config.
	 * @param n				Number of object instances to allocate.
	 * @returns				Array of allocated object instances.
	 */
	public allocateMultiple(n: number = 1): Array<T> {
		let num: number;
		if (!isInteger(n) || n < 1) {
			num = 1;
		} else {
			num = n;
		}

		while (this.state.autoIncrease && this.isAboveThreshold(num)) {
			const maxSize = Math.ceil(this.state.objectCount * this.state.increaseFactor);
			this.increaseCapacity(maxSize - this.state.objectCount);
		}

		const result: Array<T> = [];

		for (let i = 0; i < num && this.state.pool.length; i++) {
			// allocate can't return null here because the availability is checked before calling
			const item = this.allocate() as T;
			result.push(item);
		}

		return result;
	}

	/**
	 * Release object instance back to the pool for reuse later.
	 *
	 * @param object			Target pool object to be released.
	 * @returns					void
	 */
	public release(object: T): void {
		if (typeof object.cleanObj !== 'function') {
			return;
		}

		const index = this.state.used.findIndex((obj) => obj === object);
		if (index >= 0) {
			this.state.used[index] = null;
			this.wastedSpace++;
		}

		if (this.shouldCleanUsed()) {
			this.cleanUsed();
		}

		object.cleanObj();
		this.store(object);
	}

	public releaseMultiple(objects: Array<T | null>): void {
		for (let i = 0; i < objects.length; i++) {
			const obj = objects[i];

			if (obj == null) continue;

			this.release(obj);
		}

		this.cleanUsed();
	}

	public size(): number {
		return this.state.used.length - this.wastedSpace;
	}

	public utilization(allocationsPending: number = 0): number {
		if (this.state.objectCount === 0) {
			return Infinity;
		}

		let num: number = allocationsPending;
		if (!isNumber(num)) {
			num = 0;
		}

		const freeObj = this.state.pool.length - num;
		return (this.state.objectCount - freeObj) / this.state.objectCount;
	}

	/**
	 * Increase ObjectPool capacity by n slots. Pool creates and store object
	 * instances for each slot. Increasing capacity frequently or by a very large
	 * n will result in many memory allocations at once.
	 * @param n				Object Capacity to be added to pool.
	 * @returns
	 */
	public increaseCapacity(n: number): void {
		if (!isInteger(n)) {
			return;
		}

		for (let i = 0; i < n && this.state.objectCount < this.state.maxSize; i++) {
			this.store(new this.objectClass(...this.state.instanceArgs));
			this.state.objectCount++;
		}
	}

	public forEach(func: ArrayMethod<T, void>, thisArg?: unknown): ObjectPool<T> {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		let boundThis = this;
		if (thisArg) {
			boundThis = thisArg as this;
		}

		this.state.used
			.filter((elem) => elem != null)
			.forEach((elem, idx) => {
				func.call(boundThis, elem, idx, this.state.pool);
			}, boundThis);

		return this;
	}

	public map(): T[];
	public map<U>(func: ArrayMethod<T, U>, thisArg?: unknown): U[];
	public map<U>(func?: ArrayMethod<T, U>, thisArg?: unknown): U[] | T[] {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		let boundThis = this;
		if (thisArg) {
			boundThis = thisArg as this;
		}

		const filtered = this.state.used.filter((elem) => elem != null) as T[];

		if (func == null) {
			return filtered;
		}

		const mapped = filtered.map((elem, idx) => {
			return func.call(boundThis, elem, idx, filtered);
		});

		return mapped;
	}

	public stringify(): string {
		const state = {...this.state};

		state.pool = [];
		state.used = [];

		const serialized = JSON.stringify(state);

		return serialized;
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
			result.key = (): string | null => null;
			result.index = this.queryIndex.bind(this, element);
			result.delete = this.queryDelete.bind(this, result);
			resultsArray.push(result);
		});

		return resultsArray;
	}

	public clearElements(): ObjectPool<T> {
		const used = this.map();
		this.state.used = [];

		this.releaseMultiple(used);

		return this;
	}

	public reset(): ObjectPool<T> {
		this.state.pool = [];
		this.state.used = [];
		this.state.objectCount = 0;
		this.wastedSpace = 0;

		this.increaseCapacity(this.state.startSize);

		return this;
	}

	private isAboveThreshold(allocationsPending: number): boolean {
		return this.utilization(allocationsPending) > this.state.increaseBreakPoint;
	}

	private store(object: T): void {
		this.state.pool.push(object);
	}

	private shouldCleanUsed(): boolean {
		const empty = this.wastedSpace || 1;
		const total = this.state.used.length;

		return total / empty < Math.log(total);
	}

	private cleanUsed(): void {
		this.state.used = this.state.used.filter((obj) => {
			return obj != null;
		});

		this.wastedSpace = 0;
	}

	private parseOptions(options?: Options): State<T> {
		const fromSerial = this.parseOptionsSerialized(options);
		const finalState = this.parseOptionsOverrides(fromSerial, options);

		return finalState;
	}

	private parseOptionsSerialized(options?: Options): State<T> {
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
			state.autoIncrease = result.autoIncrease;
			state.increaseBreakPoint = result.increaseBreakPoint;
			state.increaseFactor = result.increaseFactor;
			state.instanceArgs = result.instanceArgs;
			state.maxSize = result.maxSize;
			state.startSize = result.objectCount;
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
				throw new Error('state is not a valid PriorityQueueState');
			}

			result = parsed;
		} catch (error) {
			result = [error, ...errors];
		}

		return result;
	}

	private parseOptionsOverrides(stateArg: State<T>, options?: Options): State<T> {
		const state: State<T> = stateArg;

		if (!options) {
			return state;
		}

		const errors: Error[] = [];

		if (options.autoIncrease != null) {
			const e = this.getStateErrorsAutoIncrease(options.autoIncrease);

			if (e.length) {
				errors.push(...e);
			} else {
				state.autoIncrease = options.autoIncrease;
			}
		}

		if (options.increaseBreakPoint != null) {
			const e = this.getStateErrorsIncreaseBreakPoint(options.increaseBreakPoint);

			if (e.length) {
				errors.push(...e);
			} else {
				state.increaseBreakPoint = options.increaseBreakPoint;
			}
		}

		if (options.increaseFactor != null) {
			const e = this.getStateErrorsIncreaseFactor(options.increaseFactor);

			if (e.length) {
				errors.push(...e);
			} else {
				state.increaseFactor = options.increaseFactor;
			}
		}

		if (options.instanceArgs != null) {
			const e = this.getStateErrorsInstanceArgs(options.instanceArgs);

			if (e.length) {
				errors.push(...e);
			} else {
				state.instanceArgs = options.instanceArgs;
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

		if (options.startSize != null) {
			const e = this.getStateErrorsStartSize(options.startSize);

			if (e.length) {
				errors.push(...e);
			} else {
				state.startSize = options.startSize;
			}
		}

		if (errors.length) {
			throw errors;
		}

		return state;
	}

	private getDefaultState(): State<T> {
		const state: State<T> = {
			type: 'ObjectPool',
			pool: [],
			used: [],
			autoIncrease: false,
			startSize: 1,
			objectCount: 0,
			maxSize: 1000,
			increaseBreakPoint: 1,
			increaseFactor: 2,
			instanceArgs: []
		};

		return state;
	}

	private getStateErrors(state: State<T>): Error[] {
		const errors: Error[] = [];

		errors.push(...this.getStateErrorsAutoIncrease(state.autoIncrease));
		errors.push(...this.getStateErrorsIncreaseBreakPoint(state.increaseBreakPoint));
		errors.push(...this.getStateErrorsIncreaseFactor(state.increaseFactor));
		errors.push(...this.getStateErrorsInstanceArgs(state.instanceArgs));
		errors.push(...this.getStateErrorsMaxSize(state.maxSize));
		errors.push(...this.getStateErrorsObjectCount(state.objectCount));
		errors.push(...this.getStateErrorsPool(state.pool));
		errors.push(...this.getStateErrorsStartSize(state.startSize));
		errors.push(...this.getStateErrorsType(state.type));
		errors.push(...this.getStateErrorsUsed(state.used));

		return errors;
	}

	private getStateErrorsAutoIncrease(data: unknown): Error[] {
		const errors: Error[] = [];

		if (data == null || typeof data !== 'boolean') {
			errors.push(Error('state autoIncrease must be a boolean'));
		}

		return errors;
	}

	private getStateErrorsIncreaseBreakPoint(data: unknown): Error[] {
		const errors: Error[] = [];

		if (data == null || !isNumber(data) || data < 0 || data > 1) {
			errors.push(Error('state increaseBreakPoint must be a number between 0 and 1'));
		}

		return errors;
	}

	private getStateErrorsIncreaseFactor(data: unknown): Error[] {
		const errors: Error[] = [];

		if (data == null || !isNumber(data) || data <= 1) {
			errors.push(Error('state increaseFactor must be a number > 1'));
		}

		return errors;
	}

	private getStateErrorsInstanceArgs(data: unknown): Error[] {
		const errors: Error[] = [];

		if (data == null || !Array.isArray(data)) {
			errors.push(Error('state instanceArgs must be an array'));
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

	private getStateErrorsObjectCount(data: unknown): Error[] {
		const errors: Error[] = [];

		if (data == null || !isInteger(data) || data < 0) {
			errors.push(Error('state objectCount must be an integer >= 0'));
		}

		return errors;
	}

	private getStateErrorsPool(data: unknown): Error[] {
		const errors: Error[] = [];

		if (data == null || !Array.isArray(data)) {
			errors.push(Error('state pool must be an array'));
		}

		return errors;
	}

	private getStateErrorsStartSize(data: unknown): Error[] {
		const errors: Error[] = [];

		if (data == null || !isInteger(data) || data < 0) {
			errors.push(Error('state startSize must be an integer >= 0'));
		}

		return errors;
	}

	private getStateErrorsType(data: unknown): Error[] {
		const errors: Error[] = [];

		if (data == null || data !== 'ObjectPool') {
			errors.push(Error('state type must be ObjectPool'));
		}

		return errors;
	}

	private getStateErrorsUsed(data: unknown): Error[] {
		const errors: Error[] = [];

		if (data == null || !Array.isArray(data)) {
			errors.push(Error('state used must be an array'));
		}

		return errors;
	}

	private queryDelete(query: QueryResult<T>): T | null {
		if (query.index() == null) {
			return null;
		}

		this.release(query.element);

		return query.element;
	}

	private queryIndex(query: T): number | null {
		const index = this.state.used.findIndex((element) => {
			return element === query;
		});

		if (index < 0) {
			return null;
		}

		return index;
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
