import ADTCollection from './collection';
import ADTCollectionSelector from './selector';
import ADTStackOptions from './stack-options';
import ADTStackState from './stack-state';

export default class ADTStack<T> implements ADTCollection<T> {
	public state: ADTStackState<T>;

	constructor(options?: ADTStackOptions<T>) {
		this.state = this.parseOptions(options);

		this.state.size = this.state.elements.length;
		this.state.top = this.state.size - 1;
	}

	public getDefaultState(): ADTStackState<T> {
		const state: ADTStackState<T> = {
			type: 'sState',
			elements: [],
			size: 0,
			top: -1,
			bottom: 0
		};

		return state;
	}

	public parseOptions(options?: ADTStackOptions<T>): ADTStackState<T> {
		const state = this.parseOptionsState(options);
		const finalState = this.parseOptionsOther(state, options);

		return finalState;
	}

	public parseOptionsState(options?: ADTStackOptions<T>): ADTStackState<T> {
		const state: ADTStackState<T> = this.getDefaultState();

		if (!options) {
			return state;
		}

		let parsed: ADTStackState<T> | Array<string> | null = null;
		let result: ADTStackState<T> | null = null;

		if (typeof options.serializedState === 'string') {
			parsed = this.parse(options.serializedState)!;

			if (Array.isArray(parsed)) {
				throw new Error(parsed.join('\n'));
			}

			result = parsed;
		}

		if (result) {
			state.elements = result.elements;
			state.size = result.size;
			state.top = result.top;
			state.bottom = result.bottom;
		}

		return state;
	}

	public parseOptionsOther(s: ADTStackState<T>, options?: ADTStackOptions<T>): ADTStackState<T> {
		let state: ADTStackState<T> | null = s;

		if (!s) {
			state = this.getDefaultState();
		}

		if (!options) {
			return state;
		}

		if (options.elements && Array.isArray(options.elements)) {
			state.elements = options.elements.slice();
		}

		if (options.size && this.isInteger(options.size) && options.size >= 0) {
			state.size = options.size;
		}
		if (options.top && this.isInteger(options.top)) {
			state.top = options.top;
		}

		return state;
	}

	public push(element: T): ADTStack<T> {
		this.state.elements.push(element);
		this.state.top++;
		this.state.size++;
		return this;
	}

	public pop(): T | null {
		if (!this.state.size) {
			return null;
		}

		const result = this.state.elements[this.state.top];
		this.state.top--;
		this.state.size--;

		return result;
	}

	public top(): T | null {
		if (!this.state.size) {
			return null;
		}

		return this.state.elements[this.state.top];
	}

	public bottom(): T | null {
		if (!this.state.size) {
			return null;
		}

		return this.state.elements[this.state.bottom];
	}

	public reverse(): ADTStack<T> {
		if (this.state.size <= 1) {
			return this;
		}

		this.state.elements = this.state.elements.reverse();
		return this;
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

	public isValidState(state: ADTStackState<T>): boolean {
		const errors = this.getStateErrors(state);

		if (errors.length) {
			return false;
		}

		return true;
	}

	public getStateErrors(state: ADTStackState<T>): Array<string> {
		const errors: Array<string> = [];

		if (!state) {
			errors.push('state is null or undefined');
			return errors;
		}

		if (state.type !== 'sState') {
			errors.push('state type must be sState');
		}
		if (!Array.isArray(state.elements)) {
			errors.push('state elements must be an array');
		}

		if (!this.isInteger(state.size) || state.size < 0) {
			errors.push('state size must be an integer >= 0');
		}
		if (!this.isInteger(state.top)) {
			errors.push('state top must be an integer');
		}
		if (state.bottom !== 0) {
			errors.push('state bottom must be 0');
		}

		return errors;
	}

	public parse(data: string): ADTStackState<T> | Array<string> | null {
		if (typeof data !== 'string' || data === '') {
			return null;
		}

		let result: ADTStackState<T> | Array<string> | null = null;
		let parsed: ADTStackState<T> | null = null;
		let errors: Array<string> = [];

		try {
			parsed = JSON.parse(data);

			if (parsed) {
				errors = this.getStateErrors(parsed);
			}

			if (errors.length) {
				throw new Error('state is not a valid ADTStackState');
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

		return JSON.stringify(this.state);
	}

	public clearElements(): ADTStack<T> {
		this.state.elements = [];
		this.state.top = -1;
		this.state.size = 0;

		return this;
	}

	public reset(): ADTStack<T> {
		this.clearElements();
		this.state.bottom = 0;

		return this;
	}

	public find(): ADTCollectionSelector<T> {
		const selector = new ADTCollectionSelector<T>(this);

		return selector;
	}
}
