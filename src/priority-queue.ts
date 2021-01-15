import {isInteger, isNumber} from './utility';

import {ADTBase} from './base';
import {ADTPriorityQueueChildren as Children} from './priority-queue/children';
import {ADTPriorityQueueComparator as Comparator} from './priority-queue/comparator';
import {ADTPriorityQueueOptions as Options} from './priority-queue/options';
import {ADTQueryFilter as QueryFilter} from './query/filter';
import {ADTQueryOptions as QueryOptions} from './query/options';
import {ADTQueryResult as QueryResult} from './query/result';
import {ADTPriorityQueueState as State} from './priority-queue/state';

export class ADTPriorityQueue<T> implements ADTBase<T> {
	private readonly state: State<T>;
	private readonly comparator: Comparator<T>;

	constructor(comparator: Comparator<T>, options?: Options<T>) {
		if (typeof comparator !== 'function') {
			throw new Error('Must have a comparator function for priority queue to operate properly');
		}

		this.comparator = comparator;

		this.state = this.parseOptions(options);
		this.heapify();
	}

	public peek(): T | null {
		if (this.isEmpty()) {
			return null;
		}

		return this.state.elements[0];
	}

	public pop(): T | null {
		if (this.isEmpty()) {
			return null;
		}

		const highestPriority = this.peek();

		this.swapNodes(0, this.size() - 1);
		this.state.elements.pop();
		this.fixHeap(0);

		return highestPriority;
	}

	public push(element: T): ADTPriorityQueue<T> {
		this.state.elements.push(element);
		this.fixHeap(this.size() - 1);

		return this;
	}

	public heapify(): void {
		if (this.isHeap()) {
			return;
		}

		let node = this.getParent(this.size() - 1);

		while (node != null && node >= 0) {
			this.fixHeap(node);
			node--;
		}
	}

	public size(): number {
		return this.state.elements.length;
	}

	public isEmpty(): boolean {
		return this.state.elements.length === 0;
	}

	public filter(func: ArrayMethod<T, boolean>, thisArg?: unknown): ADTPriorityQueue<T> {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		let boundThis = this;

		if (thisArg) {
			boundThis = thisArg as this;
		}

		const elements: T[] = [];

		this.forEach((elem, idx, arr) => {
			const result = func.call(boundThis, elem, idx, arr);
			if (result) {
				elements.push(elem);
			}
		}, boundThis);

		return new ADTPriorityQueue(this.comparator, {...this.state, elements});
	}

	public forEach(func: ArrayMethod<T, void>, thisArg?: unknown): ADTPriorityQueue<T> {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		let boundThis = this;

		if (thisArg) {
			boundThis = thisArg as this;
		}

		this.state.elements.forEach((elem, idx) => {
			func.call(boundThis, elem, idx, this.state.elements);
		}, boundThis);

		return this;
	}

	public stringify(): string {
		return JSON.stringify(this.state);
	}

	public query(filters: QueryFilter<T> | QueryFilter<T>[], opts?: QueryOptions): QueryResult<T>[] {
		const resultsArray: QueryResult<T>[] = [];
		const options = this.queryOptions(opts);

		this.forEach((element) => {
			let take = false;

			if (resultsArray.length >= options.limit) {
				return false;
			}

			if (Array.isArray(filters)) {
				take =
					!!filters.length &&
					filters.every((filter) => {
						return filter(element);
					});
			} else {
				take = filters(element);
			}

			if (!take) {
				return false;
			}

			const result: QueryResult<T> = {} as QueryResult<T>;
			result.element = element;
			result.key = (): string | null => null;
			result.index = this.queryIndex.bind(this, element);
			result.delete = this.queryDelete.bind(this, result);
			resultsArray.push(result);
		});

		return resultsArray;
	}

	public clearElements(): ADTPriorityQueue<T> {
		this.state.elements = [];

		return this;
	}

	public reset(): ADTPriorityQueue<T> {
		this.clearElements();

		this.state.type = 'PriorityQueue';

		return this;
	}

	private swapNodes(nodeOne: number, nodeTwo: number): void {
		if (nodeOne === nodeTwo) {
			return;
		}

		const copyNode = this.state.elements[nodeOne];
		this.state.elements[nodeOne] = this.state.elements[nodeTwo];
		this.state.elements[nodeTwo] = copyNode;
	}

	private fixHeap(node: number): void {
		if (this.size() <= 1) {
			return;
		}

		const startFromRoot = node < Math.floor(this.size() / 2);
		let next = this.getNext(startFromRoot, node);

		while (this.compareNodes(node, next) === false) {
			this.swapNodes(node, next);
			node = next;
			next = this.getNext(startFromRoot, node);
			if (!this.isInHeap(next)) break;
		}
	}

	private getNext(startFromRoot: boolean, node: number): number {
		if (!startFromRoot) {
			return this.getParent(node);
		} else {
			const {left, right} = this.getChildren(node);

			if (!this.isInHeap(left) || !this.isInHeap(right)) {
				return left;
			}

			const leftValue = this.state.elements[left];
			const rightValue = this.state.elements[right];

			if (rightValue === null) {
				return left;
			}

			if (leftValue === null) {
				return right;
			}

			if (this.comparator(leftValue, rightValue)) {
				return left;
			} else {
				return right;
			}
		}
	}

	private getParent(node: number): number {
		if (node < 1) {
			return -1;
		}

		return Math.floor((node - 1) / 2);
	}

	private getChildren(node: number): {left: number; right: number} {
		const defaultReturn = {left: -1, right: -1};

		const left = node * 2 + 1;
		const right = node * 2 + 2;

		if (!this.isInHeap(left)) {
			return defaultReturn;
		}

		if (!this.isInHeap(right)) {
			return {left, right: -1};
		}

		return {left, right};
	}

	private isInHeap(node: number): node is number {
		if (node < 0) {
			return false;
		}

		if (node >= this.size()) {
			return false;
		}

		return true;
	}

	private compareNodes(node: number, next: number): boolean {
		const nodeValue = this.state.elements[node];
		const nextValue = this.state.elements[next];

		const startFromRoot = node < next;

		if (nextValue == null) {
			return !startFromRoot;
		}

		if (nodeValue == null) {
			return !startFromRoot;
		}

		if (startFromRoot) {
			return this.comparator(nodeValue, nextValue);
		} else {
			return this.comparator(nextValue, nodeValue);
		}
	}

	private isHeap(): boolean {
		let result = true;

		const size = this.getParent(this.size() - 1);

		if (size === 0) {
			return true;
		}

		for (let node = 0; node < size; node++) {
			const child = this.getNext(true, node);
			result = result && this.compareNodes(node, child);
		}

		return result;
	}

	private parseOptions(options?: Options<T>): State<T> {
		const fromSerial = this.parseOptionsSerialized(options);
		const finalState = this.parseOptionsOverrides(fromSerial, options);

		return finalState;
	}

	private parseOptionsSerialized(options?: Options<T>): State<T> {
		const state: State<T> = this.getDefaultState();

		if (!options) {
			return state;
		}

		let result: State<T> | null = null;

		if (typeof options.serializedState === 'string') {
			const parsed = this.parseSerializedString(options.serializedState);

			if (Array.isArray(parsed)) {
				throw parsed;
			}

			result = parsed;
		}

		if (result) {
			state.elements = result.elements;
		}

		return state;
	}

	private parseSerializedString(data: string): State<T> | Error[] | null {
		if (typeof data !== 'string' || data === '') {
			return null;
		}

		let result: State<T> | Error[] | null = null;
		let errors: Error[] = [];

		try {
			const parsed = JSON.parse(data);

			if (parsed) {
				errors = this.getStateErrors(parsed);
			}

			if (errors.length || !parsed) {
				throw new Error('state is not a valid ADTPriorityQueueState');
			}

			result = parsed;
		} catch (error) {
			result = [error, ...errors];
		}

		return result;
	}

	private parseOptionsOverrides(stateArg: State<T>, options?: Options<T>): State<T> {
		const state: State<T> = stateArg;

		if (!options) {
			return state;
		}

		const errors: Error[] = [];

		if (options.elements != null) {
			const e = this.getStateErrorsElements(options.elements);

			if (e.length) {
				errors.push(...e);
			} else {
				state.elements = options.elements.slice();
			}
		}

		if (errors.length) {
			throw errors;
		}

		return state;
	}

	private getDefaultState(): State<T> {
		const state: State<T> = {
			type: 'PriorityQueue',
			elements: []
		};

		return state;
	}

	private getStateErrors(state: State<T>): Error[] {
		const errors: Error[] = [];

		errors.push(...this.getStateErrorsElements(state.elements));
		errors.push(...this.getStateErrorsType(state.type));

		return errors;
	}

	private getStateErrorsElements(data: unknown): Error[] {
		const errors: Error[] = [];
		if (data == null || !Array.isArray(data)) {
			errors.push(Error('state elements must be an array'));
		}

		return errors;
	}

	private getStateErrorsType(data: unknown): Error[] {
		const errors: Error[] = [];
		if (data == null || data !== 'PriorityQueue') {
			errors.push(Error('state type must be PriorityQueue'));
		}

		return errors;
	}

	private queryDelete(query: QueryResult<T>): T | null {
		const index = query.index();

		if (index === null) {
			return null;
		}

		this.swapNodes(index, this.size() - 1);
		this.state.elements.pop();

		if (this.size() > 1) {
			this.fixHeap(index);
		}

		return query.element;
	}

	private queryIndex(query: T): number | null {
		const index = this.state.elements.findIndex((element) => {
			return element === query;
		});

		if (index < 0) {
			return null;
		}

		return index;
	}

	private queryOptions(opts?: QueryOptions): Required<QueryOptions> {
		const options: Required<QueryOptions> = {
			limit: Infinity
		};

		if (opts?.limit && isNumber(opts.limit) && opts.limit >= 1) {
			options.limit = Math.round(opts.limit);
		}

		return options;
	}
}

type ArrayMethod<T, U> = (element: T, index: number, arr: T[]) => U;
