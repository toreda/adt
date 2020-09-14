import ArmorCircularQueueOptions from './circular-queue-options';
import ArmorCircularQueueState from './circular-queue-state';
import {ArmorCollection} from './collection';
import {ArmorCollectionSelector} from './selector';

export default class ArmorCircularQueue<T> implements ArmorCollection<T> {
	public state: ArmorCircularQueueState<T>;

	constructor(maxSize: number, options?: ArmorCircularQueueOptions<T>) {
		this.state = {
			type: 'cqState',
			maxSize: 100,
			elements: [],
			front: 0,
			rear: 0,
			size: 0
		};

		if (maxSize > 0) {
			this.state.maxSize = maxSize;
		} else {
			this.state.maxSize = 256;
		}

		if (options) {
			this.parseOptions(options);
		}
	}

	public parseOptions(options: ArmorCircularQueueOptions<T>): void {
		if (!options) {
			return;
		}

		if (options.state !== undefined) {
			this.parseOptionsState(options.state);
		}
	}

	public parseOptionsState(state: ArmorCircularQueueState<T> | string): void {
		if (!state) {
			return;
		}

		let result: ArmorCircularQueueState<T> | null = null;

		if (typeof state === 'string') {
			result = this.parse(state)!;

			if (!result) {
				throw new Error('state is not valid');
			}
		} else {
			result = state;

			if(!this.isValidState(result)){
				throw new Error('options.state contains errors')
			}

			/* 
			altenate error throwing
			if (result.elements && !Array.isArray(result.elements)) {
				throw new Error('state elements must be an array');
			}
			if (result.maxSize && this.isInteger(result.maxSize)) {
				throw new Error('state maxSize must be an integer');
			}
			if (result.size && this.isInteger(result.size)) {
				throw new Error('state size must ben integer number');
			}
			if (result.maxSize && this.isInteger(result.front)) {
				throw new Error('state front must be an integer');
			}
			if (result.maxSize && this.isInteger(result.rear)) {
				throw new Error('state rear must be an integer');
			} */
		}

		this.state.maxSize = result.maxSize;
		this.state.size = result.size;
		this.state.front = result.front;
		this.state.rear = result.rear;
		this.state.elements = result.elements;
	}

	public parse(data: string): ArmorCircularQueueState<T> | null {
		if (typeof data !== 'string' || data === '') {
			return null;
		}

		let result: ArmorCircularQueueState<T> | null = null;
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

		let result: string | null = null;

		result = JSON.stringify(this.state);
		if (!this.parse(result)) {
			result = null;
		}

		return result;
	}

	public wrapIndex(n: number): number {
		if (!this.isInteger(n)) {
			return -1;
		}

		let index = n;
		while (index < 0) {
			index += this.state.maxSize;
		}

		return index % this.state.maxSize;
	}

	public front(): T | null {
		if (!this.isValidState(this.state)) {
			return null;
		}

		if (!this.state.size) {
			return null;
		}

		return this.state.elements[this.state.front];
	}

	public rear(): T | null {
		if (!this.isValidState(this.state)) {
			return null;
		}

		if (!this.state.size) {
			return null;
		}

		return this.state.elements[this.wrapIndex(this.state.rear - 1)];
	}

	public push(element: T): boolean {
		if (!this.isValidState(this.state)) {
			return false;
		}

		if (this.isFull()) {
			return false;
		}

		this.state.elements[this.state.rear] = element;
		this.state.rear = this.wrapIndex(this.state.rear + 1);
		this.state.size++;

		return true;
	}

	public pop(): T | null {
		if (!this.isValidState(this.state)) {
			return null;
		}

		if (this.isEmpty()) {
			return null;
		}

		const front = this.front();

		this.state.front = this.wrapIndex(this.state.front + 1);
		this.state.size--;

		return front;
	}

	public getIndex(n: number): T | null {
		if (!this.isValidState(this.state)) {
			return null;
		}
		if (!this.isInteger(n)) {
			return null;
		}
		if (!this.state.size) {
			return null;
		}

		let index = n;
		if (index >= 0) {
			index = this.state.front + index;
		} else {
			index = this.state.rear - index;
		}

		return this.state.elements[this.wrapIndex(index)];
	}

	public isEmpty(): boolean {
		if (!this.isValidState(this.state)) {
			return false;
		}

		return this.state.size === 0;
	}

	public isFull(): boolean {
		if (!this.isValidState(this.state)) {
			return false;
		}

		return this.state.size >= this.state.maxSize;
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

	public isValidState(state: ArmorCircularQueueState<T>): boolean {
		if (!state) {
			return false;
		}
		if (state.type !== 'cqState') {
			return false;
		}

		if (!this.isInteger(state.size) || state.size < 0) {
			return false;
		}
		if (!this.isInteger(state.maxSize) || state.maxSize < 1) {
			return false;
		}

		if (!this.isInteger(state.front)) {
			return false;
		}
		if (!this.isInteger(state.rear)) {
			return false;
		}

		if (!Array.isArray(state.elements)) {
			return false;
		}

		return true;
	}

	public clear(): ArmorCircularQueue<T> {
		this.state.type = 'cqState';
		this.state.front = 0;
		this.state.rear = 0;
		this.state.size = 0;
		this.state.elements = [];

		return this;
	}

	public select(): ArmorCollectionSelector<T> {
		const selector = new ArmorCollectionSelector<T>(this);

		return selector;
	}
}
