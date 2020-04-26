import {ArmorActionResult} from '@armorjs/action-result';
import {ArmorCollection} from './collection';
import {ArmorCollectionElement} from './collection-element';
import {ArmorCollectionSelector} from './selector';
import {ArmorQueueCallable} from './callable';
import {ArmorQueueCallableSync} from './callable-sync';
import {ArmorQueueOptions} from './options';

export class ArmorQueue<T> implements ArmorCollection<T> {
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

	public select(): ArmorCollectionSelector<T> {
		const selector = new ArmorCollectionSelector<T>(this);

		return selector;
	}

	/**
	 * Add element to the end of the queue.
	 */
	public push(element: any): ArmorQueue<T> {
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

	/**
	 * Clear all elements from queue.
	 */
	public clear(): ArmorQueue<T> {
		this.elements = [];

		return this;
	}

	/** Reverse stored element order. */
	public reverse(): ArmorQueue<T> {
		this.elements.reverse();

		return this;
	}

	public executeOnAllSync(callable: ArmorQueueCallableSync): ArmorActionResult {
		return this.executeSync(callable, null);
	}

	public executeOnMatchSync(callable: ArmorQueueCallableSync, element: T): ArmorActionResult {
		return this.executeSync(callable, element);
	}

	public executeSync(callable: ArmorQueueCallableSync, element: T | null): ArmorActionResult {
		const result = new ArmorActionResult();
		for (let i = 0; i < this.elements.length; i++) {
			try {
				callable(this.elements[i], i);
			} catch (e) {}
		}

		return result;
	}

	public async executeOnAll(callable: ArmorQueueCallable): Promise<ArmorActionResult> {
		return await this.execute(callable, null);
	}

	public async executeOnMatch(callable: ArmorQueueCallable, element: T): Promise<ArmorActionResult> {
		return await this.execute(callable, element);
	}

	public async execute(callable: ArmorQueueCallable, element: T | null): Promise<ArmorActionResult> {
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
