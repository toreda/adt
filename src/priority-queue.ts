import {ArmorCollection} from './collection';
import {ArmorCollectionSelector} from './selector';

/**
 * decide what to do when no comparator is passed
 */

export interface ArmorPriorityQueueOptions<T> {
	elements?: Array<T>;
	comparator?: (nodeOneIndex: number, nodeTwoIndex: number) => boolean;
}

const defaultComparator = function (nodeOneIndex: number, nodeTwoIndex: number) {
	if (typeof nodeOneIndex !== 'number') {
		return false;
	}
	if (typeof nodeTwoIndex !== 'number') {
		return false;
	}

	return JSON.stringify(this.elements[nodeOneIndex]) < JSON.stringify(this.elements[nodeTwoIndex]);
};

export class ArmorPriorityQueue<T> implements ArmorCollection<T> {
	public elements: T[];
	public comparator: (nodeOneIndex: number, nodeTwoIndex: number) => boolean;

	constructor(options: ArmorPriorityQueueOptions<T> = {}) {
		if (typeof options.comparator === 'function') {
			this.comparator = options.comparator;
		} else {
			this.comparator = defaultComparator;
		}

		if (options.elements === undefined) {
			options.elements = [];
		}
		if (!Array.isArray(options.elements)) {
			throw 'options.elements must be an array';
		}

		this.elements = [];
		options.elements.forEach((element) => {
			this.push(element);
		});
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
		if (nodeOneIndex === nodeTwoIndex) {
			return;
		}
		if (nodeOneIndex % 1 !== 0) {
			return;
		}
		if (nodeTwoIndex % 1 !== 0) {
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
		if (parentIndex >= this.size()) {
			return null;
		}

		return parentIndex;
	}

	public getChildNodesIndexes(nodeIndex: number | null): [number | null, number | null] {
		if (typeof nodeIndex !== 'number') {
			return [null, null];
		}
		if (nodeIndex < 0) {
			return [null, null];
		}
		if (nodeIndex >= this.size()) {
			return [null, null];
		}
		if (nodeIndex % 1 !== 0) {
			return [null, null];
		}

		const childOneIndex = nodeIndex * 2 + 1;
		const childTwoIndex = nodeIndex * 2 + 2;
		if (childOneIndex >= this.size()) {
			return [null, null];
		}
		if (childTwoIndex >= this.size()) {
			return [childOneIndex, null];
		}

		return [childOneIndex, childTwoIndex];
	}

	public getNextIndex(startFromTop: boolean, nodeIndex: number | null): number | null {
		if (!startFromTop) {
			return this.getParentNodeIndex(nodeIndex);
		}

		const [leftIndex, rightIndex] = this.getChildNodesIndexes(nodeIndex);
		if (leftIndex === null || rightIndex === null) {
			return leftIndex;
		}
		if (this.elements[leftIndex] === null) {
			return rightIndex;
		}
		if (this.elements[rightIndex] === null) {
			return leftIndex;
		}

		if (this.comparator(leftIndex, rightIndex)) {
			return leftIndex;
		} else {
			return rightIndex;
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
			return this.comparator(nextIndex, nodeIndex);
		} else {
			return this.comparator(nodeIndex, nextIndex);
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
			const onlyitem = this.elements[0];
			this.elements = [];
			return onlyitem;
		}

		let highestPriority = this.front();

		this.swapNodes(0, this.size() - 1);
		this.elements.pop();
		this.fixHeap(0);

		return highestPriority;
	}
}
