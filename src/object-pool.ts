import ArmorCollection from './collection';
import ArmorCollectionSelector from './selector';
import ArmorObjectPoolInstance from './object-pool-instance';
import ArmorObjectPoolOptions from './object-pool-options';
import ArmorObjectPoolState from './object-pool-state';

export default class ArmorObjectPool<T> implements ArmorCollection<T> {
	public state: ArmorObjectPoolState<T>;
	public startSize: number = 10;
	public readonly poolObj: ArmorObjectPoolInstance<T>;

	constructor(poolObj: ArmorObjectPoolInstance<T>, options?: ArmorObjectPoolOptions<T>) {
		this.poolObj = poolObj;

		this.state = {
			type: 'opState',
			elements: [],
			objectCount: 0,
			maxSize: 1000,
			autoIncrease: false,
			increaseFactor: 2,
			increaseBreakPoint: 0.8
		};

		if (options) {
			this.parseOptions(options);
		}

		this.increase(this.startSize);
	}
	public parseOptions(options: ArmorObjectPoolOptions<T>): void {
		if (!options) {
			return;
		}

		if (options.state !== undefined) {
			this.parseOptionsState(options.state);
		}

		if (options.startSize !== undefined) {
			this.parseOptionsStartSize(options.startSize);
		}
	}
	public parseOptionsState(state: ArmorObjectPoolState<T> | string): void {
		if (!state) {
			return;
		}

		let result: ArmorObjectPoolState<T> | null = null;

		if (typeof state === 'string') {
			result = this.parse(state)!;

			if (!result) {
				throw new Error('state is not valid');
			}
		} else {
			result = state;

			if (state.type !== 'opState') {
				throw new Error('state must be an ArmorObjectPoolState');
			}
			if (typeof result.autoIncrease !== 'boolean') {
				throw new Error('state autoIncrease must be a boolean');
			}

			if (!this.isInteger(result.objectCount)) {
				throw new Error('state objectCount must be an integer');
			}
			if (!this.isInteger(result.maxSize)) {
				throw new Error('state maxSize must be an integer');
			}

			if (typeof result.increaseFactor !== 'number' || result.increaseFactor < 0) {
				throw new Error('state increaseFactor must be a positive number');
			}

			const between0and1 = state.increaseBreakPoint >= 0 && state.increaseBreakPoint <= 1;
			if (typeof result.increaseBreakPoint !== 'number' || !between0and1) {
				throw new Error('state increaseBreakPoint must be a number between 0 and 1');
			}
		}

		this.state.autoIncrease = result.autoIncrease;
		this.state.maxSize = result.maxSize;
		this.state.increaseFactor = result.increaseFactor;
		this.state.increaseBreakPoint = result.increaseBreakPoint;

		this.startSize = this.state.objectCount;
	}
	public parseOptionsStartSize(startSize: number): void {
		if (!this.isInteger(startSize)) {
			return;
		}

		this.startSize = startSize;
	}

	public utilization(n: number = 0): number {
		if (!this.isValidState(this.state)) {
			return NaN;
		}
		if (this.state.objectCount === 0) {
			return Infinity;
		}

		let num: number = n;
		if (isNaN(num)) {
			num = 0;
		}

		const freeObj = this.state.elements.length - num;
		return (this.state.objectCount - freeObj) / this.state.objectCount;
	}
	public isAboveThreshold(n: number = 0): boolean {
		return this.utilization(n) >= this.state.increaseBreakPoint;
	}

	public get(): T | null {
		if (!this.isValidState(this.state)) {
			return null;
		}

		if (this.state.autoIncrease && this.isAboveThreshold(1)) {
			this.increase(Math.ceil(this.state.objectCount * this.state.increaseFactor));
		}

		let result = this.state.elements.pop();

		if (result === undefined) {
			return null;
		} else {
			return result;
		}
	}
	public allocate(n?: number): Array<T> {
		if (!this.isValidState(this.state)) {
			return [];
		}

		let num: number;
		if (typeof n !== 'number') {
			num = 1;
		} else {
			num = Math.max(1, Math.round(n));
		}

		let result: Array<T> = [];

		while (this.state.autoIncrease && this.isAboveThreshold(num)) {
			this.increase(Math.ceil(this.state.objectCount * this.state.increaseFactor));
		}

		for (let i = 0; i < num && this.state.elements.length; i++) {
			result.push(this.state.elements.pop()!);
		}

		return result;
	}
	public increase(n: number): void {
		if (!this.isValidState(this.state)) {
			return;
		}

		for (let i = 0; i < n && this.state.objectCount < this.state.maxSize; i++) {
			this.store(new this.poolObj());
			this.state.objectCount++;
		}
	}

	public release(object: T): void {
		if (!this.isValidState(this.state)) {
			return;
		}
		if (!this.poolObj || !this.poolObj.cleanObj) {
			return;
		}

		this.poolObj.cleanObj(object);
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
	public isValidState(state: ArmorObjectPoolState<T>): boolean {
		if (!state) {
			return false;
		}
		if (state.type !== 'opState') {
			return false;
		}

		if (!Array.isArray(state.elements)) {
			return false;
		}

		if (!this.isInteger(state.objectCount) || state.objectCount < 0) {
			return false;
		}
		if (!this.isInteger(state.maxSize) || state.maxSize < 1) {
			return false;
		}

		if (typeof state.increaseFactor !== 'number' || !(state.increaseFactor >= 0)) {
			return false;
		}

		const between0and1 = state.increaseBreakPoint >= 0 && state.increaseBreakPoint <= 1;
		if (typeof state.increaseBreakPoint !== 'number' || !between0and1) {
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
			if (!result || !result.type || !this.isValidState(result!)) {
				return null;
			}
		} catch (error) {
			result = null;
		}

		return result;
	}
	public stringify(): string | null {
		if (!this.isValidState(this.state)) {
			return null;
		}

		return JSON.stringify(this.state);
	}

	public clearElements(): ArmorObjectPool<T> {
		this.state.elements = [];
		this.state.objectCount = 0;

		return this;
	}
	public reset(): ArmorObjectPool<T> {
		this.clearElements();

		this.state.type = 'opState';
		this.state.maxSize = 1000;
		this.state.increaseFactor = 2;
		this.state.increaseBreakPoint = 0.8;

		this.increase(this.startSize);

		return this;
	}

	public select(): ArmorCollectionSelector<T> {
		const selector = new ArmorCollectionSelector<T>(this);

		return selector;
	}
}
