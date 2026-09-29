import {isInteger, isNumber} from '../utility';

import type {DataStructure} from '../data/structure';
import {type ArrayMethod} from '../array/method';
import {type ObjectPoolConstructor as Constructor} from './pool/constructor';
import {type ObjectPoolInstance as Instance} from './pool/instance';
import {ObjectPoolIterator} from './pool/iterator';
import {type ObjectPoolOptions as Options} from './pool/options';
import {type QueryFilter} from '../query/filter';
import {type QueryOptions} from '../query/options';
import {type QueryResult} from '../query/result';
import type {ObjectPoolState as State} from './pool/state';

/**
 * Key of the slot each pooled object keeps: its index in `state.used` while in
 * use, `-1` while free. Defined non-enumerable on every object the pool
 * constructs, so it never shows up in `Object.keys`, JSON, or equality checks.
 * Objects the pool did not construct never carry it, which is how release
 * tells them apart.
 */
const SLOT: unique symbol = Symbol('ObjectPool.slot');

interface Slotted {
	[SLOT]?: number;
}

/** Shared `key()` for every query result. Pools have no keys. */
const queryKeyNull = (): string | null => null;

/**
 * Slot of `object` in `pool.state.used`, or null when `object` is not in use in
 * `pool`. O(1).
 */
function objectPoolSlot<T extends Instance>(
	pool: ObjectPool<T>,
	object: T | null | undefined
): number | null {
	if (object == null) {
		return null;
	}

	const slot = (object as unknown as Slotted)[SLOT];

	if (typeof slot !== 'number' || slot < 0 || slot >= pool.state.usedCount) {
		return null;
	}

	return pool.state.used[slot] === object ? slot : null;
}

/**
 * Query match on an `ObjectPool`. One instance per match; its methods live on
 * the prototype, so a match allocates nothing beyond itself.
 */
class ObjectPoolQueryResult<T extends Instance> implements QueryResult<T> {
	public readonly element: T;
	public readonly key: () => string | null = queryKeyNull;
	private readonly pool: ObjectPool<T>;

	constructor(pool: ObjectPool<T>, element: T) {
		this.pool = pool;
		this.element = element;
	}

	public index(): number | null {
		return objectPoolSlot(this.pool, this.element);
	}

	public delete(): T | null {
		return this.pool.release(this.element) ? this.element : null;
	}
}

/**
 * Pool of reusable object instances. `allocate()` and `release()` are O(1) and
 * allocate nothing once the pool has grown: free objects sit on a stack, and
 * each in-use object keeps its own slot in `state.used`, so a release never
 * searches or compacts. Release moves the last in-use object into the freed
 * slot, so in-use order is not allocation order.
 *
 * `release()` only accepts objects this pool handed out that are still in use.
 * Double releases and objects from elsewhere are ignored, so the pool never
 * holds an object twice and never grows past `maxSize`.
 *
 * @category Object Pool
 */
export class ObjectPool<T extends Instance> implements DataStructure<T> {
	public readonly state: State<T>;
	private readonly objectClass: Constructor<T>;

	constructor(objectClass: Constructor<T>, options?: Options) {
		if (typeof objectClass !== 'function') {
			throw Error('Must have a class contructor for object pool to operate properly');
		}

		this.objectClass = objectClass;

		this.state = this.parseOptions(options);

		this.increaseCapacity(this.state.startSize);
	}

	/**
	 * Iterate in-use objects. Allocates one iterator per loop, which reuses a
	 * single result object. `forEach` is the non-allocating path.
	 */
	[Symbol.iterator](): ObjectPoolIterator<T> {
		return new ObjectPoolIterator<T>(this);
	}

	/**
	 * Allocate a single object instance. Pool size will increase when
	 * no instances are available for allocation, unless the pool is
	 * already at it's maximum size defined by ObjectPool's config.
	 * O(1), and allocates nothing unless the pool grows.
	 * @returns				Object instance of type T if available.
	 *						null when an instance can't be allocated.
	 */
	public allocate(): T | null {
		const state = this.state;

		if (state.autoIncrease && this.isAboveThreshold(1)) {
			this.grow();
		}

		if (state.freeCount === 0) {
			return null;
		}

		state.freeCount--;
		const result = state.pool[state.freeCount] as T;
		state.pool[state.freeCount] = null;

		(result as unknown as Slotted)[SLOT] = state.usedCount;
		state.used[state.usedCount] = result;
		state.usedCount++;

		return result;
	}

	/**
	 * Allocate multiple object instances from pool in a single call. Pool
	 * size will increase to add more instances if no object instances are
	 * available, unless pool has reached it's maximum size as defined by
	 * the ObjectPool config.
	 * @param n				Number of object instances to allocate.
	 * @returns				Array of allocated object instances. Shorter than
	 *						`n` when the pool cannot supply them all.
	 */
	public allocateMultiple(n: number = 1): Array<T> {
		let num: number;
		if (!isInteger(n) || n < 1) {
			num = 1;
		} else {
			num = n;
		}

		while (this.state.autoIncrease && this.isAboveThreshold(num)) {
			const before = this.state.objectCount;
			this.grow();

			// At maxSize growth adds nothing, and the loop would never exit.
			if (this.state.objectCount === before) {
				break;
			}
		}

		const result: Array<T> = [];

		for (let i = 0; i < num && this.state.freeCount > 0; i++) {
			// allocate can't return null here because the availability is checked before calling
			result.push(this.allocate() as T);
		}

		return result;
	}

	/**
	 * Release object instance back to the pool for reuse later. The object is
	 * cleaned with `cleanObj()` and must not be used afterwards. O(1), and
	 * allocates nothing.
	 *
	 * Objects that are not currently in use in this pool (already released, or
	 * never allocated from it) are ignored and left untouched.
	 *
	 * @param object			Target pool object to be released.
	 * @returns					true when the object was released, false when it
	 *							was ignored.
	 */
	public release(object: T): boolean {
		const slot = objectPoolSlot(this, object);

		if (slot === null) {
			return false;
		}

		const state = this.state;
		state.usedCount--;
		const last = state.used[state.usedCount] as T;

		if (last !== object) {
			state.used[slot] = last;
			(last as unknown as Slotted)[SLOT] = slot;
		}

		state.used[state.usedCount] = null;
		(object as unknown as Slotted)[SLOT] = -1;

		object.cleanObj();
		this.store(object);

		return true;
	}

	/**
	 * Release each object in `objects`. `null` entries and objects not in use
	 * in this pool are skipped. Allocates nothing.
	 */
	public releaseMultiple(objects: Array<T | null>): void {
		for (let i = 0; i < objects.length; i++) {
			const obj = objects[i];

			if (obj == null) continue;

			this.release(obj);
		}
	}

	/**
	 * Number of objects currently in use.
	 */
	public size(): number {
		return this.state.usedCount;
	}

	public utilization(allocationsPending: number = 0): number {
		if (this.state.objectCount === 0) {
			return Infinity;
		}

		let num: number = allocationsPending;
		if (!isNumber(num)) {
			num = 0;
		}

		const freeObj = this.state.freeCount - num;
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
			const object = new this.objectClass(...this.state.instanceArgs);
			Object.defineProperty(object, SLOT, {value: -1, writable: true, enumerable: false});
			this.store(object);
			this.state.objectCount++;
		}
	}

	/**
	 * Call `func` on each in-use object. Allocates nothing. Walks from the last
	 * slot down, so `func` may release the object it was given. Releasing any
	 * other object during the walk can skip or repeat objects.
	 *
	 * @param func			Called with the object, its slot in `state.used`, and
	 *						`state.used`. Slots from `size()` on hold `null`.
	 * @param thisArg		`this` inside `func`. Defaults to the pool.
	 */
	public forEach(func: ArrayMethod<T, void>, thisArg?: unknown): ObjectPool<T> {
		const boundThis = thisArg ? thisArg : this;
		const used = this.state.used as T[];

		for (let i = this.state.usedCount - 1; i >= 0; i--) {
			// func may have released several objects, shrinking the in-use range.
			if (i >= this.state.usedCount) {
				continue;
			}

			func.call(boundThis, used[i], i, used);
		}

		return this;
	}

	/**
	 * New array of the in-use objects in slot order, or of `func`'s result for
	 * each. Allocates only the returned array.
	 */
	public map(): T[];
	public map<U>(func: ArrayMethod<T, U>, thisArg?: unknown): U[];
	public map<U>(func?: ArrayMethod<T, U>, thisArg?: unknown): U[] | T[] {
		const boundThis = thisArg ? thisArg : this;
		const used = this.state.used as T[];
		const count = this.state.usedCount;

		if (func == null) {
			const copy: T[] = new Array(count);
			for (let i = 0; i < count; i++) {
				copy[i] = used[i];
			}

			return copy;
		}

		const mapped: U[] = new Array(count);
		for (let i = 0; i < count; i++) {
			mapped[i] = func.call(boundThis, used[i], i, used);
		}

		return mapped;
	}

	/**
	 * The pool's config and object count as a JSON string. Objects are not
	 * included.
	 */
	public stringify(): string {
		const state = this.state;

		return JSON.stringify({
			type: state.type,
			autoIncrease: state.autoIncrease,
			increaseBreakPoint: state.increaseBreakPoint,
			increaseFactor: state.increaseFactor,
			instanceArgs: state.instanceArgs,
			maxSize: state.maxSize,
			objectCount: state.objectCount,
			startSize: state.startSize
		});
	}

	/**
	 * In-use objects matching every filter, up to `opts.limit`. Allocates the
	 * result array and one result per match. The walk itself allocates nothing.
	 */
	public query(filters: QueryFilter<T> | QueryFilter<T>[], opts?: QueryOptions): QueryResult<T>[] {
		const results: QueryResult<T>[] = [];

		if (Array.isArray(filters) && filters.length === 0) {
			return results;
		}

		const limit = this.queryLimit(opts);
		const used = this.state.used as T[];

		for (let i = 0; i < this.state.usedCount && results.length < limit; i++) {
			const element = used[i];

			if (this.queryMatch(filters, element)) {
				results.push(new ObjectPoolQueryResult<T>(this, element));
			}
		}

		return results;
	}

	/**
	 * Release every in-use object. Each is cleaned with `cleanObj()`. Capacity
	 * is kept. Allocates nothing.
	 */
	public clearElements(): ObjectPool<T> {
		const state = this.state;

		for (let i = 0; i < state.usedCount; i++) {
			const object = state.used[i] as T;
			state.used[i] = null;
			(object as unknown as Slotted)[SLOT] = -1;
			object.cleanObj();
			this.store(object);
		}

		state.usedCount = 0;

		return this;
	}

	/**
	 * Release every in-use object, then shrink or refill the pool to
	 * `startSize` objects. Objects kept are reused, not reconstructed.
	 */
	public reset(): ObjectPool<T> {
		const state = this.state;

		this.clearElements();

		while (state.freeCount > state.startSize) {
			state.freeCount--;
			state.pool[state.freeCount] = null;
			state.objectCount--;
		}

		state.pool.length = state.freeCount;
		state.used.length = 0;

		this.increaseCapacity(state.startSize - state.objectCount);

		return this;
	}

	/**
	 * Same test as `utilization(allocationsPending) > increaseBreakPoint`, but
	 * multiplied out instead of divided. `utilization()` returns a fractional
	 * number to its caller, which V8 boxes on the heap, and this runs on every
	 * `allocate()` when `autoIncrease` is on.
	 */
	private isAboveThreshold(allocationsPending: number): boolean {
		const state = this.state;

		if (state.objectCount === 0) {
			return true;
		}

		const inUse = state.objectCount - state.freeCount + allocationsPending;

		return inUse > state.increaseBreakPoint * state.objectCount;
	}

	/**
	 * Grow by `increaseFactor`, capped at `maxSize`.
	 */
	private grow(): void {
		// `|| 1`: an empty pool would otherwise never grow.
		const target = Math.ceil(this.state.objectCount * this.state.increaseFactor) || 1;
		this.increaseCapacity(target - this.state.objectCount);
	}

	private store(object: T): void {
		this.state.pool[this.state.freeCount] = object;
		this.state.freeCount++;
	}

	private queryMatch(filters: QueryFilter<T> | QueryFilter<T>[], element: T): boolean {
		if (!Array.isArray(filters)) {
			return filters(element);
		}

		for (let f = 0; f < filters.length; f++) {
			if (!filters[f](element)) {
				return false;
			}
		}

		return true;
	}

	private queryLimit(opts?: QueryOptions): number {
		if (opts?.limit && isNumber(opts.limit) && opts.limit >= 1) {
			return Math.round(opts.limit);
		}

		return Infinity;
	}

	private parseOptions(options?: Options): State<T> {
		const state: State<T> = this.getDefaultState();

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
			freeCount: 0,
			used: [],
			usedCount: 0,
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

	private getStateErrorsStartSize(data: unknown): Error[] {
		const errors: Error[] = [];

		if (data == null || !isInteger(data) || data < 0) {
			errors.push(Error('state startSize must be an integer >= 0'));
		}

		return errors;
	}
}
