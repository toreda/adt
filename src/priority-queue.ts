import {ArmorCollection} from './collection';
import {ArmorCollectionSelector} from './selector';
import ArmorPriorityQueueComparator from './priority-queue-comparator';
import ArmorPriorityQueueNodeChildren from './priority-queue-children';
import ArmorPriorityQueueOptions from './priority-queue-options';

export default class ArmorPriorityQueue<T> implements ArmorCollection<T> {
	public elements: T[];
	public readonly comparator: ArmorPriorityQueueComparator<T>;

	constructor(comparator: ArmorPriorityQueueComparator<T>, options?: ArmorPriorityQueueOptions<T>) {
		if (typeof comparator !== 'function') {
			throw new Error('Must have a comparator function for priority queue to operate properly');
		}

		this.elements = [];
		this.comparator = comparator;

		if (options) {
			this.parseOptions(options);
		}
	}

	public parseOptions(options: ArmorPriorityQueueOptions<T>): void {
		if (options.elements !== undefined) {
			if (!Array.isArray(options.elements)) {
				throw 'options.elements must be an array';
			}
			options.elements.forEach((element) => {
				this.push(element);
			});
		}
	}

	public select(): ArmorCollectionSelector<T> {
		const selector = new ArmorCollectionSelector<T>(this);

		return selector;
	}

	public clear(): ArmorPriorityQueue<T> {
		this.elements = [];

		return this;
	}

	public size(): number {
		if (!Array.isArray(this.elements)) {
			return 0;
		}

		return this.elements.length;
	}

	public front(): T | null {
		if (this.size() === 0) {
			return null;
		}

		return this.elements[0];
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

		const nodeOneInfo = this.elements[nodeOneIndex];
		this.elements[nodeOneIndex] = this.elements[nodeTwoIndex];
		this.elements[nodeTwoIndex] = nodeOneInfo;
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

		const parentIndex = Math.floor((nodeIndex - 1) / 2);
		// check if this is necessary
		if (parentIndex >= this.size()) {
			return null;
		}

		return parentIndex;
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

		if (this.elements[childIndexes.left] === null) {
			return childIndexes.right;
		}
		if (this.elements[childIndexes.right] === null) {
			return childIndexes.left;
		}

		if (this.comparator(this.elements[childIndexes.left], this.elements[childIndexes.right])) {
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

		const nodeValue = this.elements[nodeIndex];
		const nextValue = this.elements[nextIndex];
		const startFromTop = nodeIndex < nextIndex;

		if (nodeValue === null) {
			return false;
		}
		if (nextValue === null) {
			return false;
		}

		// i think this is superfluous, but not deleting until testing is complete
		// if (!startFromTop && nodeIndex <= 0) {
		// 	console.log(nodeIndex,nextIndex);
		// 	return false;
		// }

		if (startFromTop) {
			return this.comparator(this.elements[nextIndex], this.elements[nodeIndex]);
		} else {
			return this.comparator(this.elements[nodeIndex], this.elements[nextIndex]);
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
		this.elements.push(element);
		this.fixHeap(this.size() - 1);

		return this;
	}

	public pop(): T | null {
		if (this.size() === 0) {
			return null;
		}

		if (this.size() === 1) {
			return this.elements.pop()!;
		}

		let highestPriority = this.front();

		this.swapNodes(0, this.size() - 1);
		this.elements.pop();
		this.fixHeap(0);

		return highestPriority;
	}
}
