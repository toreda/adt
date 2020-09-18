import ArmorCollection from './collection';
import ArmorCollectionSelector from './selector';
import ArmorObjectPoolInstance from './object-pool-instance';
import ArmorObjectPoolOptions from './object-pool-options';
import ArmorObjectPoolState from './object-pool-state';

export default class ArmorObjectPool<T> implements ArmorCollection<T> {
	public readonly errorFlags: Array<string>;
	public readonly state: ArmorObjectPoolState<T>;
	public readonly objectClass: ArmorObjectPoolInstance<T>;
	public readonly startSize: number;

	constructor(objectClass: ArmorObjectPoolInstance<T>, options?: ArmorObjectPoolOptions<T>) {
		if (typeof objectClass !== 'function') {
			throw new Error('Must have a class contructor for object pool to operate properly');
		}
		this.objectClass = objectClass;

		this.errorFlags = [];

		const properties = this.parseOptions(options);
		this.state = this.parseOptions(options).state!;
		this.startSize = this.parseOptions(options).startSize!;

		this.increaseCapacity(this.startSize);
	}
	public parseOptions(options?: ArmorObjectPoolOptions<T>): ArmorObjectPoolOptions<T> {
		const state = this.parseOptionsState(options);
		const startSize = this.parseOptionsStartSize(state, options);

		state.objectCount = 0;
		const properties = {
			state: this.parseOptionsState(options),
			startSize: this.parseOptionsStartSize(state, options)
		};

		return properties;
	}
	public parseOptionsState(options?: ArmorObjectPoolOptions<T>): ArmorObjectPoolState<T> {
		const state: ArmorObjectPoolState<T> = {
			type: 'opState',
			elements: [],
			autoIncrease: false,
			maxSize: 1000,
			objectCount: 10,
			increaseBreakPoint: 0.8,
			increaseFactor: 2
		}

		if (!options) {
			return state;
		}

		let result: ArmorObjectPoolState<T> | null = null;

		if (typeof options.serializedState === 'string') {
			result = this.parse(options.serializedState)!;

			if (!this.isValidState(result!)) {
				throw new Error(this.errorFlags.join('\n'));
			}
		}

		if (result) {
			state.autoIncrease = result.autoIncrease;
			state.maxSize = result.maxSize;
			state.objectCount = result.objectCount;
			state.increaseBreakPoint = result.increaseBreakPoint;
			state.increaseFactor = result.increaseFactor;
		}

		for (let key in options.state) {
			state[key] = options.state[key];
		}

		return state;
	}
	public parseOptionsStartSize(state: ArmorObjectPoolState<T>, options?: ArmorObjectPoolOptions<T>): number {
		if (!this.isValidState(state)) {
			return 10;
		}

		if (!options || !options.startSize) {
			return state.objectCount;
		}
		if (!this.isInteger(options.startSize)) {
			return state.objectCount;
		}
		if (options.startSize < 1) {
			return state.objectCount;
		}

		return options.startSize;
	}

	public utilization(n: number = 0): number {
		if (!this.isValidState(this.state)) {
			return NaN;
		}
		if (this.state.objectCount === 0) {
			return Infinity;
		}

		let num: number = n;
		if (typeof num !== 'number' || isNaN(num)) {
			num = 0;
		}

		const freeObj = this.state.elements.length - num;
		return (this.state.objectCount - freeObj) / this.state.objectCount;
	}
	public isAboveThreshold(n: number = 0): boolean {
		return this.utilization(n) >= this.state.increaseBreakPoint;
	}

	public allocate(): T | null {
		if (!this.isValidState(this.state)) {
			return null;
		}

		if (this.state.autoIncrease && this.isAboveThreshold(1)) {
			this.increaseCapacity(Math.ceil(this.state.objectCount * this.state.increaseFactor));
		}

		let result = this.state.elements.pop();

		if (result === undefined) {
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

	public release(object: T): void {
		if (!this.objectClass || !this.objectClass.cleanObj) {
			return;
		}

		this.objectClass.cleanObj(object);
		this.store(object);
	}
	public store(object: T): void {
		if (!this.isValidState(this.state)) {
			return;
		}

		this.state.elements.push(object);
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
	public isValidState(state: ArmorObjectPoolState<T>): boolean {
		this.errorFlags.length = 0;

		if (!state) {
			this.errorFlags.push('state is null or undefined');
			return false;
		}

		if (state.type !== 'opState') {
			this.errorFlags.push('state type must be opState');
		}
		if (!Array.isArray(state.elements)) {
			this.errorFlags.push('state elements must be an array');
		}

		if (typeof state.autoIncrease !== 'boolean') {
			this.errorFlags.push('state autoIncrease must be a boolean');
		}

		if (!this.isInteger(state.maxSize) || state.maxSize < 1) {
			this.errorFlags.push('state maxSize must be an integer >= 1');
		}
		if (!this.isInteger(state.objectCount) || state.objectCount < 0) {
			this.errorFlags.push('state objectCount must be an integer >= 0');
		}

		const between0and1 = state.increaseBreakPoint >= 0 && state.increaseBreakPoint <= 1;
		if (!this.isFloat(state.increaseBreakPoint) || !between0and1) {
			this.errorFlags.push('state increaseBreakPoint must be a number between 0 and 1');
		}
		if (!this.isFloat(state.increaseFactor) || state.increaseFactor < 0) {
			this.errorFlags.push('state increaseFactor must be a positive number');
		}

		if (this.errorFlags.length) {
			return false;
		}

		return true;
	}

	public parse(data: string): ArmorObjectPoolState<T> | null {
		if (typeof data !== 'string' || data === '') {
			return null;
		}

		let result: ArmorObjectPoolState<T> | null = null;
		try {
			result = JSON.parse(data);

			if (!result) {
				return null;
			}

			if (!this.isValidState(result)) {
				throw new Error('state is not a valid ArmorObjectPoolState');
			}
		} catch (error) {
			console.error([error.message].concat(this.errorFlags).join('\n'));
			result = null;
		}

		return result;
	}
	public stringify(): string | null {
		if (!this.isValidState(this.state)) {
			return null;
		}

		return JSON.stringify(this.state).replace(/"elements":\[.*?\]/, '"elements":[]');
	}

	public clearElements(): ArmorObjectPool<T> {
		this.state.elements = [];
		this.state.objectCount = 0;

		return this;
	}
	public reset(): ArmorObjectPool<T> {
		this.clearElements();

		this.state.type = 'opState';
		this.state.autoIncrease = false;
		this.state.increaseFactor = 2;
		this.state.increaseBreakPoint = 0.8;

		this.increaseCapacity(this.startSize);

		return this;
	}

	public select(): ArmorCollectionSelector<T> {
		const selector = new ArmorCollectionSelector<T>(this);

		return selector;
	}
}
