import ADTCollection from './collection';
import ADTCollectionSelector from './selector';
import {ADTQueueCallable} from './callable';
import {ADTQueueCallableSync} from './callable-sync';
import {ArmorActionResult} from '@armorjs/action-result';

export default class ADTQueue<T> implements ADTCollection<T> {
	public elements: T[];

	constructor(elements: T[] = []) {
		if (Array.isArray(elements)) {
			// Shallow clone by default.
			// TODO: Add deep copy option.
			this.elements = elements.slice();
		} else {
			this.elements = [];
		}
	}

	/**
	 * Add element to the end of the queue.
	 */
	public push(element: any): ADTQueue<T> {
		this.elements.push(element);

		return this;
	}

	/**
	 * Returns first element in queue, or null if queue is empty.
	 *
	 * @returns First element in queue of type <T> or null.
	 *
	 */
	public front(): T | null {
		if (this.isEmpty()) {
			return null;
		}

		return this.elements[0];
	}

	/**
	 * Remove and return first element from queue. Returns
	 * null if queue is empty when called.
	 */
	public pop(): T | null {
		if (this.isEmpty()) {
			return null;
		}

		const element = this.elements[0];
		this.elements.splice(0, 1);
		return element;
	}

	/**
	 * Returns number of elements in queue.
	 */
	public size(): number {
		return this.elements.length;
	}

	/**
	 * Returns true if queue is empty or false
	 * when >= 1 elements queued.
	 */
	public isEmpty(): boolean {
		return this.elements.length === 0;
	}

	/** Reverse stored element order. */
	public reverse(): ADTQueue<T> {
		this.elements.reverse();

		return this;
	}

	public parse(data: string): any | null {
		return null;
	}

	public stringify(): string | null {
		return null;
	}

	/**
	 * Clear all elements from queue.
	 */
	public clearElements(): ADTQueue<T> {
		this.elements = [];

		return this;
	}

	public reset(): ADTQueue<T> {
		this.clearElements();

		return this;
	}

	public select(): ADTCollectionSelector<T> {
		const selector = new ADTCollectionSelector<T>(this);

		return selector;
	}

	public executeOnAllSync(callable: ADTQueueCallableSync): ArmorActionResult {
		return this.executeSync(callable, null);
	}

	public executeOnMatchSync(callable: ADTQueueCallableSync, element: T): ArmorActionResult {
		return this.executeSync(callable, element);
	}

	public executeSync(callable: ADTQueueCallableSync, element: T | null): ArmorActionResult {
		const result = new ArmorActionResult();
		for (let i = 0; i < this.elements.length; i++) {
			try {
				callable(this.elements[i], i);
			} catch (e) {}
		}

		return result;
	}

	public async executeOnAll(callable: ADTQueueCallable): Promise<ArmorActionResult> {
		return await this.execute(callable, null);
	}

	public async executeOnMatch(callable: ADTQueueCallable, element: T): Promise<ArmorActionResult> {
		return await this.execute(callable, element);
	}

	public async execute(callable: ADTQueueCallable, element: T | null): Promise<ArmorActionResult> {
		const result = new ArmorActionResult();
		for (let i = 0; i < this.elements.length; i++) {
			try {
				await callable(this.elements[i], i);
			} catch (e) {
				result.error(e);
			}
		}

		return result;
	}
}
