import ArmorCollection from './collection';
import ArmorCollectionSelector from './selector';
import ArmorObjectPoolInstance from './object-pool-instance';
import ArmorObjectPoolOptions from './object-pool-options';
import ArmorObjectPoolState from './object-pool-state';

export default class ArmorObjectPool<T> implements ArmorCollection<T> {
	public state: ArmorObjectPoolState<T>;
	public readonly startSize: number;
	public objectCount: number = 0;
	public readonly poolObj: ArmorObjectPoolInstance<T>;

	constructor(poolObj: ArmorObjectPoolInstance<T>, options?: ArmorObjectPoolOptions<T>) {
		this.poolObj = poolObj;
		this.startSize = 0;

		this.state = {
			type: 'opState',
			elements: [],
			maxSize: 256,
			autoIncrease: false,
			increaseFactor: 2,
			increaseBreakPoint: 0.8
		};
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

			if (!Array.isArray(result.elements)) {
				throw new Error('state elements must be an array');
			}

			if (!this.isInteger(result.maxSize)) {
				throw new Error('state maxSize must be an integer');
			}

			if (typeof result.increaseFactor !== 'number' || result.increaseFactor < 0) {
				throw new Error('state increaseFactor must be a positive number');
			}

			const between0and1 = state.increaseBreakPoint >= 0 && state.increaseBreakPoint <= 1
			if ( typeof result.increaseBreakPoint !== 'number' || !between0and1 ) {
				throw new Error('state increaseBreakPoint must be a number between 0 and 1');
			}
		}

		this.state.autoIncrease = result.autoIncrease;
		this.state.maxSize = result.maxSize;
		this.state.elements = result.elements;
		this.state.increaseFactor = result.increaseFactor;
		this.state.increaseBreakPoint = result.increaseBreakPoint;

		this.objectCount = this.state.elements.length;
	}

	public parseOptionsStartSize(startSize: number): void {
		this.increase(startSize);
	}

	public get(): T | null {
		if (this.isEmpty() && this.state.autoIncrease) {
			this.increase(1);
		}

		let result = this.state.elements.pop();

		if (result === undefined) {
			return null;
		} else {
			return result;
		}
	}

	public isEmpty(): boolean {
		return this.state.elements.length === 0;
	}

	public increase(n: number): void {
		if (this.objectCount < this.state.maxSize) {
			this.allocate(n);
		}
	}

	public allocate(n: number = 1): void {
		for (let i = 0; i < n; i++) {
			this.store(new this.poolObj());
			this.objectCount++;
		}
	}

	public store(object: T): void {
		this.state.elements.push(object);
	}

	public release(object: T): void {
		this.poolObj.cleanObj(object);
		this.store(object);
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

		if (!this.isInteger(state.maxSize) || state.maxSize < 1) {
			return false;
		}

		if (typeof state.increaseFactor !== 'number' || state.increaseFactor < 0) {
			return false;
		}

		const between0and1 = state.increaseBreakPoint >= 0 && state.increaseBreakPoint <= 1
		if ( typeof state.increaseBreakPoint !== 'number' || !between0and1 ) {
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

		return this;
	}

	public reset(): ArmorObjectPool<T> {
		this.clearElements();
		this.state.type = 'opState';

		return this;
	}

	public select(): ArmorCollectionSelector<T> {
		const selector = new ArmorCollectionSelector<T>(this);

		return selector;
	}
}
