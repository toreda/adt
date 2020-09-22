import ArmorCollection from './collection';
import { ArmorCollectionQuery } from './query';
import ArmorCollectionSelector from './selector';
import ArmorPriorityQueueComparator from './priority-queue-comparator';
import ArmorPriorityQueueNodeChildren from './priority-queue-children';
import ArmorPriorityQueueOptions from './priority-queue-options';
import ArmorPriorityQueueState from './priority-queue-state';

export default class ArmorPriorityQueue<T> implements ArmorCollection<T> {
	public state: ArmorPriorityQueueState<T>;
	public readonly comparator: ArmorPriorityQueueComparator<T>;

	constructor(comparator: ArmorPriorityQueueComparator<T>, options?: ArmorPriorityQueueOptions<T>) {
		if (typeof comparator !== 'function') {
			throw new Error('Must have a comparator function for priority queue to operate properly');
		}

		this.comparator = comparator;

		this.state = this.parseOptions(options);
	}

	public getDefaultState(): ArmorPriorityQueueState<T> {
		const state: ArmorPriorityQueueState<T> = {
			type: 'pqState',
			elements: []
		};

		return state;
	}

	public parseOptions(options?: ArmorPriorityQueueOptions<T>): ArmorPriorityQueueState<T> {
		const state = this.parseOptionsState(options);
		const finalState = this.parseOptionsOther(state, options);

		return finalState;
	}

	public parseOptionsState(options?: ArmorPriorityQueueOptions<T>): ArmorPriorityQueueState<T> {
		const state: ArmorPriorityQueueState<T> = this.getDefaultState();

		if (!options) {
			return state;
		}

		let parsed: ArmorPriorityQueueState<T> | Array<string> | null = null;
		let result: ArmorPriorityQueueState<T> | null = null;

		if (typeof options.serializedState === 'string') {
			parsed = this.parse(options.serializedState)!;

			if (Array.isArray(parsed)) {
				throw new Error(parsed.join('\n'));
			}

			result = parsed;
		}

		if (result) {
			state.elements = result.elements;
		}

		return state;
	}

	public parseOptionsOther(
		s: ArmorPriorityQueueState<T>,
		options?: ArmorPriorityQueueOptions<T>
	): ArmorPriorityQueueState<T> {
		let state: ArmorPriorityQueueState<T> | null = s;

		if (!s) {
			state = this.getDefaultState();
		}

		if (!options) {
			return state;
		}

		if (options.elements && Array.isArray(options.elements)) {
			state.elements = options.elements;
		}

		return state;
	}

	public size(): number {
		if (!this.isValidState(this.state)) {
			return 0;
		}

		return this.state.elements.length;
	}

	public front(): T | null {
		if (this.size() === 0) {
			return null;
		}

		return this.state.elements[0];
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

	public getChildNodesIndexes(nodeIndex: number | null): ArmorPriorityQueueNodeChildren {
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

		if (this.comparator(this.state.elements[childIndexes.left], this.state.elements[childIndexes.right])) {
			return childIndexes.left;
		} else {
			return childIndexes.right;
		}
	}

	public isHeapUnbalanced(nodeIndex: number | null, nextIndex: number | null): Boolean {
		if (typeof nodeIndex !== 'number') {
			return false;
		}
		if (typeof nextIndex !== 'number') {
			return false;
		}

		const nodeValue = this.state.elements[nodeIndex];
		const nextValue = this.state.elements[nextIndex];
		const startFromTop = nodeIndex < nextIndex;

		if (nodeValue === null || nodeValue === undefined) {
			return false;
		}
		if (nextValue === null || nextValue === undefined) {
			return false;
		}

		if (startFromTop) {
			return this.comparator(this.state.elements[nextIndex], this.state.elements[nodeIndex]);
		} else {
			return this.comparator(this.state.elements[nodeIndex], this.state.elements[nextIndex]);
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

		const startFromTop = nodeIndex === 0;
		let nextIndex = this.getNextIndex(startFromTop, nodeIndex);

		while (this.isHeapUnbalanced(nodeIndex, nextIndex)) {
			this.swapNodes(nodeIndex, nextIndex);
			nodeIndex = nextIndex;
			nextIndex = this.getNextIndex(startFromTop, nodeIndex);
		}
	}

	public push(element: T): ArmorPriorityQueue<T> {
		this.state.elements.push(element);
		this.fixHeap(this.size() - 1);

		return this;
	}

	public pop(): T | null {
		if (this.size() === 0) {
			return null;
		}

		if (this.size() === 1) {
			return this.state.elements.pop()!;
		}

		let highestPriority = this.front();

		this.swapNodes(0, this.size() - 1);
		this.state.elements.pop();
		this.fixHeap(0);

		return highestPriority;
	}

	public isValidState(state: ArmorPriorityQueueState<T>): boolean {
		const errors = this.getStateErrors(state);

		if (errors.length) {
			return false;
		}

		return true;
	}

	public getStateErrors(state: ArmorPriorityQueueState<T>): Array<string> {
		const errors: Array<string> = [];

		if (!state) {
			errors.push('state is null or undefined');
			return errors;
		}

		if (state.type !== 'pqState') {
			errors.push('state type must be pqState');
		}
		if (!Array.isArray(state.elements)) {
			errors.push('state elements must be an array');
		}

		return errors;
	}

	public parse(data: string): ArmorPriorityQueueState<T> | Array<string> | null {
		if (typeof data !== 'string' || data === '') {
			return null;
		}

		let result: ArmorPriorityQueueState<T> | Array<string> | null = null;
		let parsed: ArmorPriorityQueueState<T> | null = null;
		let errors: Array<string> = [];

		try {
			parsed = JSON.parse(data);

			if (parsed) {
				errors = this.getStateErrors(parsed);
			}

			if (errors.length) {
				throw new Error('state is not a valid ArmorPriorityQueueState');
			}

			result = parsed
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

	public clearElements(): ArmorPriorityQueue<T> {
		this.state.elements = [];

		return this;
	}

	public reset(): ArmorPriorityQueue<T> {
		this.clearElements();
		
		this.state.type = 'pqState';

		return this;
	}

	public find(query: ArmorCollectionQuery): ArmorCollectionSelector<T> {
		const selector = new ArmorCollectionSelector<T>(this, query);

		return selector;
	}
}
