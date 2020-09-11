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
			front: -1,
			rear: -1
		};

		if (maxSize > 1) {
			this.state.maxSize = maxSize;
		} else {
			this.state.maxSize = 100;
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

			if (result.elements && !Array.isArray(result.elements)) {
				throw new Error('state elements must be an array');
			}
			if (result.maxSize && typeof result.maxSize !== 'number') {
				throw new Error('state maxSize must be a number');
			}
			if (result.maxSize && typeof result.front !== 'number') {
				throw new Error('state front must be a number');
			}
			if (result.maxSize && typeof result.rear !== 'number') {
				throw new Error('state rear must be a number');
			}
		}

		this.state.maxSize = result.maxSize;
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
			if (!result || !result.type || result.type !== 'cqState') {
				return null;
			}
		} catch (error) {
			result = null;
		}

		return result;
	}

	public stringify(): string | null {
		let result: string | null = null;

		result = JSON.stringify(this.state);
		if (!this.parse(result)) {
			result = null;
		}

		return result;
	}

	public nextIndex(n: number): number {
		return (n + 1) % this.state.maxSize;
	}

	public front(): T | null {
		return this.state.elements[this.state.front];
	}

	public rear(): T | null {
		return this.state.elements[this.state.rear];
	}

	public push(element: T): boolean {
		if (this.isFull()) {
			return false;
		}

		if (this.state.front === -1) {
			this.state.front = 0;
		}

		this.state.rear = this.nextIndex(this.state.rear);
		this.state.elements[this.state.rear] = element;

		return true;
	}

	public pop(): T | null {
		if (this.isEmpty()) {
			return null;
		}

		const front = this.front();

		if (this.state.front == this.state.rear) {
			this.state.front = this.state.rear = -1;
		} else {
			this.state.front = this.nextIndex(this.state.front);
		}

		return front;
	}

	public size(): number {
		if (this.state.front === -1) {
			return 0;
		}

		if (this.state.front > this.state.rear) {
			return this.state.maxSize - (this.state.front - this.state.rear) + 1;
		} else {
			return this.state.rear - this.state.front + 1;
		}
	}

	public isEmpty(): boolean {
		// return this.state.front === this.state.rear + 1;
		return this.state.front === -1;
	}

	public isFull(): boolean {
		return this.state.front === this.nextIndex(this.state.rear);
	}

	public clear(): ArmorCircularQueue<T> {
		this.state.front = -1;
		this.state.rear = -1;
		this.state.elements = [];

		return this;
	}

	public select(): ArmorCollectionSelector<T> {
		const selector = new ArmorCollectionSelector<T>(this);

		return selector;
	}
}
