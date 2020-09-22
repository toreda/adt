import ADTCollection from './collection';
import ADTCollectionSelector from './selector';
import {ADTQueueCallable} from './callable';
import {ADTQueueCallableSync} from './callable-sync';
import ADTQueueOptions from './queue-options';
import ADTQueueState from './queue-state';
import {ArmorActionResult} from '@armorjs/action-result';

export default class ADTQueue<T> implements ADTCollection<T> {
	public state: ADTQueueState<T>;

	constructor(options?: ADTQueueOptions<T>) {
			// Shallow clone by default.
			// TODO: Add deep copy option.
			this.state = this.parseOptions(options);
		}

	public getDefaultState(): ADTQueueState<T> {
		const state: ADTQueueState<T> = {
			type: 'qState',
			elements: [],
			deepClone: false,
			objectPool: false
		}

		return state;
	}

	
	public parseOptions(options?: ADTQueueOptions<T>): ADTQueueState<T> {
		const state = this.parseOptionsState(options);
		const finalState = this.parseOptionsOther(state, options);

		return finalState;
	}

	public parseOptionsState(options?: ADTQueueOptions<T>): ADTQueueState<T> {
		const state: ADTQueueState<T> = this.getDefaultState();

		if (!options) {
			return state;
		}

		let parsed: ADTQueueState<T> | Array<string> | null = null;
		let result: ADTQueueState<T> | null = null;

		if (typeof options.serializedState === 'string') {
			parsed = this.parse(options.serializedState);

			if (Array.isArray(parsed)) {
				throw new Error(parsed.join('\n'));
			}

			result = parsed;
		}

		if (result) {
			state.elements = result.elements;
			state.deepClone = result.deepClone;
			state.objectPool = result.objectPool;
		}

		return state;
	}

	public parseOptionsOther(s: ADTQueueState<T>, options?: ADTQueueOptions<T>): ADTQueueState<T> {
		let state: ADTQueueState<T> | null = s;

		if (!s) {
			state = this.getDefaultState();
		}

		if (!options) {
			return state;
		}

		if (options.elements && Array.isArray(options.elements)) {
			state.elements = options.elements.slice();
		}
		if (options.deepClone && typeof options.deepClone === 'boolean') {
			state.deepClone = options.deepClone;
		}
		if (options.objectPool && typeof options.objectPool === 'boolean') {
			state.objectPool = options.objectPool;
		}

		return state;
	}

	/**
	 * Add element to the end of the queue.
	 */
	public push(element: any): ADTQueue<T> {
		this.state.elements.push(element);

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

		return this.state.elements[0];
	}

	/**
	 * Remove and return first element from queue. Returns
	 * null if queue is empty when called.
	 */
	public pop(): T | null {
		if (this.isEmpty()) {
			return null;
		}

		const element = this.state.elements[0];
		this.state.elements.splice(0, 1);
		return element;
	}

	/**
	 * Returns number of elements in queue.
	 */
	public size(): number {
		return this.state.elements.length;
	}

	/**
	 * Returns true if queue is empty or false
	 * when >= 1 elements queued.
	 */
	public isEmpty(): boolean {
		return this.state.elements.length === 0;
	}

	/** Reverse stored element order. */
	public reverse(): ADTQueue<T> {
		this.state.elements.reverse();

		return this;
	}

	public isValidState(state: ADTQueueState<T>): boolean {
		const errors = this.getStateErrors(state);

		if (errors.length) {
			return false;
		}

		return true;
	}

	public getStateErrors(state: ADTQueueState<T>): Array<string> {
		const errors: Array<string> = [];

		if (!state) {
			errors.push('state is null or undefined');
			return errors;
		}

		if (state.type !== 'qState') {
			errors.push('state type must be qState');
		}
		if (!Array.isArray(state.elements)) {
			errors.push('state elements must be an array');
		}

		if (typeof state.deepClone !== 'boolean') {
			errors.push('state deepClone must be a boolean');
		}
		if (typeof state.objectPool !== 'boolean') {
			errors.push('state objectPool must be a boolean');
		}

		return errors;
	}

	public parse(data: string): ADTQueueState<T> | Array<string> | null {
		if (typeof data !== 'string' || data === '') {
			return null;
		}

		let result: ADTQueueState<T> | Array<string> | null = null;
		let parsed: ADTQueueState<T> | null = null;
		let errors: Array<string> = [];

		try {
			parsed = JSON.parse(data);

			if (parsed) {
				errors = this.getStateErrors(parsed);
			}

			if (errors.length) {
				throw new Error('state is not a valid ADTQueueState');
			}

			result = parsed;
		} catch (error) {
			result = [error.message].concat(errors);
		}

		return result;
	}

	public stringify(): string | null {
		if (!this.isValidState(this.state)) {
			return null;
		}

		let state = JSON.stringify(this.state);

		return state;
	}

	/**
	 * Clear all elements from queue.
	 */
	public clearElements(): ADTQueue<T> {
		this.state.elements = [];

		return this;
	}

	public reset(): ADTQueue<T> {
		this.clearElements();

		return this;
	}

	public find(): ArmorCollectionSelector<T> {
		const selector = new ArmorCollectionSelector<T>(this);

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
		for (let i = 0; i < this.state.elements.length; i++) {
			try {
				callable(this.state.elements[i], i);
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
		for (let i = 0; i < this.state.elements.length; i++) {
			try {
				await callable(this.state.elements[i], i);
			} catch (e) {
				result.error(e);
			}
		}

		return result;
	}
}
