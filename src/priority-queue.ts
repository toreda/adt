import {ADTBase} from './base';
import {ADTPriorityQueueChildren as Children} from './priority-queue/children';
import {ADTPriorityQueueComparator as Comparator} from './priority-queue/comparator';
import {ADTPriorityQueueOptions as Options} from './priority-queue/options';
import {ADTQueryFilter as QueryFilter} from './query/filter';
import {ADTQueryOptions as QueryOptions} from './query/options';
import {ADTQueryResult as QueryResult} from './query/result';
import {ADTPriorityQueueState as State} from './priority-queue/state';

export class ADTPriorityQueue<T> implements ADTBase<T> {
	public state: State<T>;
	public readonly comparator: Comparator<T>;

	constructor(comparator: Comparator<T>, options?: Options<T>) {
		if (typeof comparator !== 'function') {
			throw new Error('Must have a comparator function for priority queue to operate properly');
		}

		this.comparator = comparator;

		this.state = this.parseOptions(options);
		this.heapify();
	}

	public parseOptions(options?: Options<T>): State<T> {
		const state = this.parseOptionsState(options);
		const finalState = this.parseOptionsOther(state, options);

		return finalState;
	}

	public parseOptionsState(options?: Options<T>): State<T> {
		const state: State<T> = this.getDefaultState();

		if (!options) {
			return state;
		}

		let result: State<T> | null = null;

		if (typeof options.serializedState === 'string') {
			const parsed = this.parseOptionsStateString(options.serializedState);

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

	public parseOptionsStateString(data: string): State<T> | Error[] | null {
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

			if (errors.length) {
				throw new Error('state is not a valid ADTPriorityQueueState');
			}

			result = parsed;
		} catch (error) {
			result = [error, ...errors];
		}

		return result;
	}

	public parseOptionsOther(s: State<T>, options?: Options<T>): State<T> {
		let state: State<T> | null = s;

		if (!s) {
			state = this.getDefaultState();
		}

		if (!options) {
			return state;
		}

		if (options.elements != null && this.getStateErrorsElements(options.elements).length === 0) {
			state.elements = options.elements.slice();
		}

		return state;
	}

	public getDefaultState(): State<T> {
		const state: State<T> = {
			type: 'PriorityQueue',
			elements: []
		};

		return state;
	}

	public getStateErrors(state: State<T>): Error[] {
		const errors: Error[] = [];

		if (!state) {
			errors.push(Error('state is null or undefined'));
			return errors;
		}

		errors.push(...this.getStateErrorsElements(state.elements));
		errors.push(...this.getStateErrorsType(state.type));

		return errors;
	}

	public getStateErrorsElements(data: unknown): Error[] {
		const errors: Error[] = [];
		if (data == null || !Array.isArray(data)) {
			errors.push(Error('state elements must be an array'));
		}

		return errors;
	}

	public getStateErrorsType(data: unknown): Error[] {
		const errors: Error[] = [];
		if (data == null || data !== 'PriorityQueue') {
			errors.push(Error('state type must be PriorityQueue'));
		}

		return errors;
	}

	public isValidState(state: State<T>): boolean {
		return this.getStateErrors(state).length === 0;
	}

	public queryDelete(query: QueryResult<T>): T | null {
		if (!query || !query.index) {
			return null;
		}

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

	public queryIndex(query: T): number | null {
		const index = this.state.elements.findIndex((element) => {
			return element === query;
		});

		if (index < 0) {
			return null;
		}

		return index;
	}

	public queryOptions(opts?: QueryOptions): Required<QueryOptions> {
		const options: Required<QueryOptions> = {
			limit: Infinity
		};

		if (opts?.limit && typeof opts.limit === 'number' && opts.limit >= 1) {
			options.limit = Math.round(opts.limit);
		}

		return options;
	}

	public areNodesValidHeap(nodeIndex: number | null, nextIndex: number | null): boolean {
		if (typeof nextIndex !== 'number') {
			return true;
		}
		if (typeof nodeIndex !== 'number') {
			return true;
		}

		const nodeValue = this.state.elements[nodeIndex];
		const nextValue = this.state.elements[nextIndex];
		const startFromTop = nodeIndex < nextIndex;

		if (nodeValue == null) {
			return startFromTop;
		}
		if (nextValue == null) {
			return !startFromTop;
		}

		if (startFromTop) {
			return this.comparator(this.state.elements[nodeIndex], this.state.elements[nextIndex]);
		} else {
			return this.comparator(this.state.elements[nextIndex], this.state.elements[nodeIndex]);
		}
	}

	public fixHeap(nodeIndex: number | null): void {
		if (this.size() <= 1) {
			return;
		}
		if (typeof nodeIndex !== 'number') {
			return;
		}
		if (nodeIndex < 0) {
			return;
		}
		if (nodeIndex >= this.size()) {
			return;
		}
		if (nodeIndex % 1 !== 0) {
			return;
		}

		const startFromTop = nodeIndex < Math.floor(this.size() / 2);
		let nextIndex = this.getNextIndex(startFromTop, nodeIndex);

		while (this.areNodesValidHeap(nodeIndex, nextIndex) === false) {
			this.swapNodes(nodeIndex, nextIndex);
			nodeIndex = nextIndex;
			nextIndex = this.getNextIndex(startFromTop, nodeIndex);
		}
	}

	public getChildNodesIndexes(nodeIndex: number | null): Children {
		if (typeof nodeIndex !== 'number') {
			return {left: null, right: null};
		}
		if (nodeIndex < 0) {
			return {left: null, right: null};
		}
		if (nodeIndex >= this.size()) {
			return {left: null, right: null};
		}
		if (nodeIndex % 1 !== 0) {
			return {left: null, right: null};
		}

		const childOneIndex = nodeIndex * 2 + 1;
		const childTwoIndex = nodeIndex * 2 + 2;
		if (childOneIndex >= this.size()) {
			return {left: null, right: null};
		}
		if (childTwoIndex >= this.size()) {
			return {left: childOneIndex, right: null};
		}

		return {left: childOneIndex, right: childTwoIndex};
	}

	public getNextIndex(startFromTop: boolean, nodeIndex: number | null): number | null {
		if (!startFromTop) {
			return this.getParentNodeIndex(nodeIndex);
		}

		const childIndexes = this.getChildNodesIndexes(nodeIndex);
		if (childIndexes.left === null || childIndexes.right === null) {
			return childIndexes.left;
		}

		if (this.state.elements[childIndexes.left] === null) {
			return childIndexes.right;
		}
		if (this.state.elements[childIndexes.right] === null) {
			return childIndexes.left;
		}

		if (
			this.comparator(this.state.elements[childIndexes.left], this.state.elements[childIndexes.right])
		) {
			return childIndexes.left;
		} else {
			return childIndexes.right;
		}
	}

	public getParentNodeIndex(nodeIndex: number | null): number | null {
		if (typeof nodeIndex !== 'number') {
			return null;
		}
		if (nodeIndex <= 0) {
			return null;
		}
		if (nodeIndex >= this.size()) {
			return null;
		}
		if (nodeIndex % 1 !== 0) {
			return null;
		}

		return Math.floor((nodeIndex - 1) / 2);
	}

	public isHeapSorted(): boolean {
		let result = true;
		const size = this.getParentNodeIndex(this.size() - 1);

		if (!size) {
			return true;
		}

		for (let i = 0; i <= size; i++) {
			const child = this.getNextIndex(true, i);
			result = result && this.areNodesValidHeap(i, child);
		}

		return result;
	}

	public heapify(): void {
		if (this.size() <= 1) {
			return;
		}
		if (this.isHeapSorted()) {
			return;
		}

		let nodeIndex = this.getParentNodeIndex(this.size() - 1);

		while (nodeIndex !== null && nodeIndex >= 0) {
			this.fixHeap(nodeIndex);
			nodeIndex--;
		}
	}

	public swapNodes(nodeOneIndex: number | null, nodeTwoIndex: number | null): void {
		if (typeof nodeOneIndex !== 'number') {
			return;
		}
		if (typeof nodeTwoIndex !== 'number') {
			return;
		}

		if (nodeOneIndex < 0) {
			return;
		}
		if (nodeTwoIndex < 0) {
			return;
		}

		if (nodeOneIndex >= this.size()) {
			return;
		}
		if (nodeTwoIndex >= this.size()) {
			return;
		}

		if (nodeOneIndex % 1 !== 0) {
			return;
		}
		if (nodeTwoIndex % 1 !== 0) {
			return;
		}

		if (nodeOneIndex === nodeTwoIndex) {
			return;
		}

		const nodeOneInfo = this.state.elements[nodeOneIndex];
		this.state.elements[nodeOneIndex] = this.state.elements[nodeTwoIndex];
		this.state.elements[nodeTwoIndex] = nodeOneInfo;
	}

	public clearElements(): ADTPriorityQueue<T> {
		this.state.elements = [];

		return this;
	}

	// prettier-ignore
	// eslint-disable-next-line max-len, prettier/prettier
	public filter(func: (element: T, index: number, arr: T[]) => boolean, thisArg?: unknown): ADTPriorityQueue<T> {
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

	// prettier-ignore
	// eslint-disable-next-line max-len, prettier/prettier
	public forEach(func: (element: T, index: number, arr: T[]) => void, thisArg?: unknown): ADTPriorityQueue<T> {
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

	public front(): T | null {
		if (this.size() === 0) {
			return null;
		}

		return this.state.elements[0];
	}

	public pop(): T | null {
		if (this.size() === 0) {
			return null;
		}

		const highestPriority = this.front();

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

	public reset(): ADTPriorityQueue<T> {
		this.clearElements();

		this.state.type = 'PriorityQueue';

		return this;
	}

	public size(): number {
		if (!this.isValidState(this.state)) {
			return 0;
		}

		return this.state.elements.length;
	}

	public stringify(): string | null {
		if (!this.isValidState(this.state)) {
			return null;
		}

		return JSON.stringify(this.state);
	}
}
