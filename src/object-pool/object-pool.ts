import ADTBase from '../base/base';
import ADTObjectPoolInstance from './object-pool-instance';
import ADTObjectPoolOptions from './object-pool-options';
import ADTObjectPoolState from './object-pool-state';
import ADTQueryFilter from '../query/query-filter';
import ADTQueryOptions from '../query/query-options';
import ADTQueryResult from '../query/query-result';

export default class ADTObjectPool<T> implements ADTBase<T> {
	public readonly state: ADTObjectPoolState<T>;
	public readonly objectClass: ADTObjectPoolInstance<T>;

	constructor(objectClass: ADTObjectPoolInstance<T>, options?: ADTObjectPoolOptions<T>) {
		if (typeof objectClass !== 'function') {
			throw new Error('Must have a class contructor for object pool to operate properly');
		}
		this.objectClass = objectClass;

		this.state = this.parseOptions(options);

		this.increaseCapacity(this.state.startSize);
	}

	public parseOptions(options?: ADTObjectPoolOptions<T>): ADTObjectPoolState<T> {
		const state = this.parseOptionsState(options);
		const finalState = this.parseOptionsOther(state, options);

		return finalState;
	}

	public parseOptionsState(options?: ADTObjectPoolOptions<T>): ADTObjectPoolState<T> {
		const state: ADTObjectPoolState<T> = this.getDefaultState();

		if (!options) {
			return state;
		}

		let parsed: ADTObjectPoolState<T> | Array<string> | null = null;
		let result: ADTObjectPoolState<T> | null = null;

		if (typeof options.serializedState === 'string') {
			parsed = this.parseOptionsStateString(options.serializedState);

			if (Array.isArray(parsed)) {
				throw new Error(parsed.join('\n'));
			}

			result = parsed;
		}

		if (result) {
			state.autoIncrease = result.autoIncrease;

			state.startSize = result.objectCount;
			state.maxSize = result.maxSize;

			state.increaseBreakPoint = result.increaseBreakPoint;
			state.increaseFactor = result.increaseFactor;
		}

		return state;
	}

	public parseOptionsStateString(state: string): ADTObjectPoolState<T> | Array<string> | null {
		if (typeof state !== 'string' || state === '') {
			return null;
		}

		let result: ADTObjectPoolState<T> | Array<string> | null = null;
		let parsed: ADTObjectPoolState<T> | null = null;
		let errors: Array<string> = [];

		try {
			parsed = JSON.parse(state);

			if (parsed) {
				errors = this.getStateErrors(parsed);
			}

			if (errors.length) {
				throw new Error('state is not a valid ADTObjectPoolState');
			}

			result = parsed;
		} catch (error) {
			result = [error.message].concat(errors);
		}

		return result;
	}

	public parseOptionsOther(s: ADTObjectPoolState<T>, options?: ADTObjectPoolOptions<T>): ADTObjectPoolState<T> {
		let state: ADTObjectPoolState<T> | null = s;

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

		if (options.increaseBreakPoint) {
			const between0and1 = options.increaseBreakPoint >= 0 && options.increaseBreakPoint <= 1;
			if (this.isFloat(options.increaseBreakPoint) && between0and1) {
				state.increaseBreakPoint = options.increaseBreakPoint;
			}
		}
		if (options.increaseFactor && this.isFloat(options.increaseFactor) && options.increaseFactor >= 0) {
			state.increaseFactor = options.increaseFactor;
		}

		return state;
	}

	public getDefaultState(): ADTObjectPoolState<T> {
		const state: ADTObjectPoolState<T> = {
			type: 'opState',
			elements: [],
			autoIncrease: false,
			startSize: 10,
			objectCount: 0,
			maxSize: 1000,
			increaseBreakPoint: 0.8,
			increaseFactor: 2
		};

		return state;
	}

	public getStateErrors(state: ADTObjectPoolState<T>): Array<string> {
		const errors: Array<string> = [];

		if (!state) {
			errors.push('state is null or undefined');
			return errors;
		}

		if (state.type !== 'opState') {
			errors.push('state type must be opState');
		}
		if (!Array.isArray(state.elements)) {
			errors.push('state elements must be an array');
		}

		if (typeof state.autoIncrease !== 'boolean') {
			errors.push('state autoIncrease must be a boolean');
		}

		if (!this.isInteger(state.startSize) || state.startSize < 0) {
			errors.push('state startSize must be an integer >= 0');
		}
		if (!this.isInteger(state.objectCount) || state.objectCount < 0) {
			errors.push('state objectCount must be an integer >= 0');
		}
		if (!this.isInteger(state.maxSize) || state.maxSize < 1) {
			errors.push('state maxSize must be an integer >= 1');
		}

		const between0and1 = state.increaseBreakPoint >= 0 && state.increaseBreakPoint <= 1;
		if (!this.isFloat(state.increaseBreakPoint) || !between0and1) {
			errors.push('state increaseBreakPoint must be a number between 0 and 1');
		}
		if (!this.isFloat(state.increaseFactor) || state.increaseFactor < 0) {
			errors.push('state increaseFactor must be a positive number');
		}

		return errors;
	}

	public isAboveThreshold(allocationsPending: number = 0): boolean {
		return this.utilization(allocationsPending) >= this.state.increaseBreakPoint;
	}

	public isInteger(n: number): boolean {
		if (typeof n !== 'number') {
			return false;
		}
		if (n % 1 !== 0) {
			return false;
		}

		return true;
	}

	public isFloat(n: number): boolean {
		if (typeof n !== 'number') {
			return false;
		}
		if (isNaN(n)) {
			return false;
		}

		return true;
	}

	public isValidState(state: ADTObjectPoolState<T>): boolean {
		const errors = this.getStateErrors(state);

		if (errors.length) {
			return false;
		}

		return true;
	}

	public store(object: T): void {
		if (!this.isValidState(this.state)) {
			return;
		}

		this.state.elements.push(object);
	}

	public allocate(): T | null {
		if (!this.isValidState(this.state)) {
			return null;
		}

		if (this.state.autoIncrease && this.isAboveThreshold(1)) {
			this.increaseCapacity(Math.ceil(this.state.objectCount * this.state.increaseFactor));
		}

		let result = this.state.elements.pop();

		if (result == null) {
			return null;
		}

		return result;
	}

	public allocateMultiple(n: number = 1): Array<T> {
		let num: number;
		if (!this.isInteger(n) || n < 1) {
			num = 1;
		} else {
			num = n;
		}

		let result: Array<T> = [];

		for (let i = 0; i < num && this.state.elements.length; i++) {
			const item = this.allocate();
			if (item !== null) {
				result.push(item);
			}
		}

		return result;
	}

	public clearElements(): ADTObjectPool<T> {
		this.state.elements = [];
		this.state.objectCount = 0;

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
			this.store(new this.objectClass());
			this.state.objectCount++;
		}
	}

	public query(filters: ADTQueryFilter<T> | ADTQueryFilter<T>[], options?: ADTQueryOptions): ADTQueryResult<T>[] {
		return [];
	}

	public release(object: T): void {
		if (!this.objectClass || !this.objectClass.cleanObj) {
			return;
		}

		this.objectClass.cleanObj(object);
		this.store(object);
	}

	public releaseMultiple(objects: Array<T>): void {
		for (let i = 0; i < objects.length; i++) {
			this.release(objects[i]);
		}
	}

	public reset(): ADTObjectPool<T> {
		this.clearElements();

		this.state.type = 'opState';
		this.state.autoIncrease = false;
		this.state.increaseFactor = 2;
		this.state.increaseBreakPoint = 0.8;

		this.increaseCapacity(this.state.startSize);

		return this;
	}

	public stringify(): string | null {
		if (!this.isValidState(this.state)) {
			return null;
		}

		let state = JSON.stringify(this.state);
		state = state.replace(/"elements":\[.*?\]/, '"elements":[]');

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

		const freeObj = this.state.elements.length - num;
		return (this.state.objectCount - freeObj) / this.state.objectCount;
	}
}
