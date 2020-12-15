import {ADTBase} from './base';
import {ADTObjectPoolConstructor as Constructor} from './object-pool/constructor';
import {ADTObjectPoolInstance as Instance} from './object-pool/instance';
import {ADTObjectPoolOptions as Options} from './object-pool/options';
import {ADTQueryFilter as QueryFilter} from './query/filter';
import {ADTQueryOptions as QueryOptions} from './query/options';
import {ADTQueryResult as QueryResult} from './query/result';
import {ADTObjectPoolState as State} from './object-pool/state';

export class ADTObjectPool<T extends Instance> implements ADTBase<T> {
	public readonly state: State<T>;
	public readonly objectClass: Constructor<T>;
	private wastedSpace: number = 0;

	constructor(objectClass: Constructor<T>, options?: Options) {
		if (typeof objectClass !== 'function') {
			throw Error('Must have a class contructor for object pool to operate properly');
		}

		this.objectClass = objectClass;

		this.state = this.parseOptions(options);

		this.increaseCapacity(this.state.startSize);
	}

	public parseOptions(options?: Options): State<T> {
		const state = this.parseOptionsState(options);
		const finalState = this.parseOptionsOther(state, options);

		return finalState;
	}

	public parseOptionsState(options?: Options): State<T> {
		const state: State<T> = this.getDefaultState();

		if (!options) {
			return state;
		}

		let result: State<T> | null = null;

		if (typeof options.serializedState === 'string') {
			const parsed = this.parseOptionsStateString(options.serializedState);

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

	public parseOptionsStateString(state: string): State<T> | Error[] | null {
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

			if (errors.length) {
				throw Error('state is not a valid ADTObjectPoolState');
			}

			result = parsed;
		} catch (error) {
			result = [error, ...errors];
		}

		return result;
	}

	public parseOptionsOther(s: State<T>, options?: Options): State<T> {
		let state: State<T> | null = s;

		if (!s) {
			state = this.getDefaultState();
		}

		if (!options) {
			return state;
		}

		if (options.startSize && this.isInteger(options.startSize) && options.startSize >= 0) {
			state.startSize = options.startSize;
		}
		if (options.maxSize && this.isInteger(options.maxSize) && options.maxSize >= 1) {
			state.maxSize = options.maxSize;
		}

		if (typeof options.autoIncrease === 'boolean') {
			state.autoIncrease = options.autoIncrease;
		}
		if (options.increaseBreakPoint) {
			const between0and1 = options.increaseBreakPoint >= 0 && options.increaseBreakPoint <= 1;
			if (this.isFloat(options.increaseBreakPoint) && between0and1) {
				state.increaseBreakPoint = options.increaseBreakPoint;
			}
		}
		if (options.increaseFactor && this.isFloat(options.increaseFactor) && options.increaseFactor > 1) {
			state.increaseFactor = options.increaseFactor;
		}

		if (options.instanceArgs && Array.isArray(options.instanceArgs)) {
			state.instanceArgs = options.instanceArgs;
		}

		return state;
	}

	public cleanUsed(): void {
		this.state.used = this.state.used.filter((obj) => {
			return obj != null;
		});

		this.wastedSpace = 0;
	}

	public getDefaultState(): State<T> {
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

	public getStateErrors(state: State<T>): Error[] {
		const errors: Error[] = [];

		if (!state) {
			errors.push(Error('state is null or undefined'));
			return errors;
		}

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

	public getStateErrorsAutoIncrease(data: unknown): Error[] {
		const result: Error[] = [];

		if (data == null || typeof data !== 'boolean') {
			result.push(Error('state autoIncrease must be a boolean'));
		}

		return result;
	}

	public getStateErrorsIncreaseBreakPoint(data: unknown): Error[] {
		const result: Error[] = [];

		if (data == null || !this.isFloat(data) || !((data as number) >= 0 && (data as number) <= 1)) {
			result.push(Error('state increaseBreakPoint must be a number between 0 and 1'));
		}

		return result;
	}

	public getStateErrorsIncreaseFactor(data: unknown): Error[] {
		const result: Error[] = [];

		if (data == null || !this.isFloat(data) || (data as number) <= 1) {
			result.push(Error('state increaseFactor must be a number > 1'));
		}

		return result;
	}

	public getStateErrorsInstanceArgs(data: unknown): Error[] {
		const result: Error[] = [];

		if (data == null || !Array.isArray(data)) {
			result.push(Error('state instanceArgs must be an array'));
		}

		return result;
	}

	public getStateErrorsMaxSize(data: unknown): Error[] {
		const result: Error[] = [];

		if (data == null || !this.isInteger(data) || (data as number) < 1) {
			result.push(Error('state maxSize must be an integer >= 1'));
		}

		return result;
	}

	public getStateErrorsObjectCount(data: unknown): Error[] {
		const result: Error[] = [];

		if (data == null || !this.isInteger(data) || (data as number) < 0) {
			result.push(Error('state objectCount must be an integer >= 0'));
		}

		return result;
	}

	public getStateErrorsPool(data: unknown): Error[] {
		const result: Error[] = [];

		if (data == null || !Array.isArray(data)) {
			result.push(Error('state pool must be an array'));
		}

		return result;
	}

	public getStateErrorsStartSize(data: unknown): Error[] {
		const result: Error[] = [];

		if (data == null || !this.isInteger(data) || (data as number) < 0) {
			result.push(Error('state startSize must be an integer >= 0'));
		}

		return result;
	}

	public getStateErrorsType(data: unknown): Error[] {
		const result: Error[] = [];

		if (data == null || data !== 'ObjectPool') {
			result.push(Error('state type must be ObjectPool'));
		}

		return result;
	}

	public getStateErrorsUsed(data: unknown): Error[] {
		const result: Error[] = [];

		if (data == null || !Array.isArray(data)) {
			result.push(Error('state used must be an array'));
		}

		return result;
	}

	public isAboveThreshold(allocationsPending: number = 0): boolean {
		return this.utilization(allocationsPending) > this.state.increaseBreakPoint;
	}

	public isInteger(n: unknown): boolean {
		if (typeof n !== 'number') {
			return false;
		}
		if (n % 1 !== 0) {
			return false;
		}

		return true;
	}

	public isFloat(n: unknown): boolean {
		if (typeof n !== 'number') {
			return false;
		}
		if (isNaN(n)) {
			return false;
		}

		return true;
	}

	public isValidState(state: State<T>): boolean {
		return this.getStateErrors(state).length === 0;
	}

	public queryDelete(query: QueryResult<T>): T | null {
		if (query.element == null) {
			return null;
		}

		this.release(query.element);

		return query.element;
	}

	public queryIndex(query: T): number | null {
		const index = this.state.used.findIndex((element) => {
			return element === query;
		});

		if (index < 0) {
			return null;
		}

		return index;
	}

	public queryOptions(opts?: QueryOptions): Required<QueryOptions> {
		const options: Required<QueryOptions> = {
			limit: Infinity
		};

		if (opts?.limit && typeof opts.limit === 'number' && opts.limit >= 1) {
			options.limit = Math.round(opts.limit);
		}

		return options;
	}

	public shouldCleanUsed(): boolean {
		const empty = this.wastedSpace || 1;
		const total = this.state.used.length;

		return total / empty < Math.log(total);
	}

	public store(object: T): void {
		if (!this.isValidState(this.state)) {
			return;
		}

		this.state.pool.push(object);
	}

	public allocate(): T | null {
		if (!this.isValidState(this.state)) {
			return null;
		}

		if (this.state.autoIncrease && this.isAboveThreshold(1)) {
			const maxSize = Math.ceil(this.state.objectCount * this.state.increaseFactor);
			this.increaseCapacity(maxSize - this.state.objectCount);
		}

		const result = this.state.pool.pop();

		if (result == null) {
			return null;
		}

		this.state.used.push(result);

		return result;
	}

	public allocateMultiple(n: number = 1): Array<T> {
		let num: number;
		if (!this.isInteger(n) || n < 1) {
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
			const item = this.allocate();
			if (item !== null) {
				result.push(item);
			}
		}

		return result;
	}

	public clearElements(): ADTObjectPool<T> {
		this.state.pool = [];
		this.state.objectCount = 0;

		return this;
	}

	public forEach(func: (element: T, index: number, arr: T[]) => void, thisArg?: unknown): ADTObjectPool<T> {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		let boundThis = this;
		if (thisArg) {
			boundThis = thisArg as this;
		}

		this.state.used.forEach((elem, idx) => {
			if (elem == null) {
				return;
			}

			func.call(boundThis, elem, idx, this.state.pool);
		}, boundThis);

		return this;
	}

	public increaseCapacity(n: number): void {
		if (!this.isValidState(this.state)) {
			return;
		}
		if (!this.isInteger(n)) {
			return;
		}

		for (let i = 0; i < n && this.state.objectCount < this.state.maxSize; i++) {
			this.store(new this.objectClass(...this.state.instanceArgs));
			this.state.objectCount++;
		}
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

	public releaseMultiple(objects: Array<T>): void {
		for (let i = 0; i < objects.length; i++) {
			this.release(objects[i]);
		}

		this.cleanUsed();
	}

	public reset(): ADTObjectPool<T> {
		this.clearElements();

		this.state.type = 'ObjectPool';
		this.state.autoIncrease = false;
		this.state.increaseFactor = 2;
		this.state.increaseBreakPoint = 1;

		this.increaseCapacity(this.state.startSize);

		return this;
	}

	public stringify(): string | null {
		if (!this.isValidState(this.state)) {
			return null;
		}

		let state = JSON.stringify(this.state);
		state = state.replace(/"(pool|used)":\[.*?\]/g, '"$1":[]');

		return state;
	}

	public utilization(allocationsPending: number = 0): number {
		if (!this.isValidState(this.state)) {
			return NaN;
		}
		if (this.state.objectCount === 0) {
			return Infinity;
		}

		let num: number = allocationsPending;
		if (typeof num !== 'number' || isNaN(num)) {
			num = 0;
		}

		const freeObj = this.state.pool.length - num;
		return (this.state.objectCount - freeObj) / this.state.objectCount;
	}
}
