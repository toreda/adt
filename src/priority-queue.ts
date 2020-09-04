import {ArmorCollection} from './collection';
import {ArmorCollectionSelector} from './selector';

type Index = (number | null);

export interface ArmorPriorityQueueNode<T> {
	rank: number | null;
	data: T;
}

export class ArmorPriorityQueue<T> implements ArmorCollection<T> {
	public elements: ArmorPriorityQueueNode<T>[];

	constructor(elements: ArmorPriorityQueueNode<T>[] = []) {
		this.elements = [];
		if (Array.isArray(elements)) {
			elements.forEach(element => {
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

	public front(): ArmorPriorityQueueNode<T> | null {
		if (this.size() === 0) {
			return null;
		}
		return this.elements[0];
	}

	public swapNodes(nodeOneIndex: Index, nodeTwoIndex: Index): void {
		if (nodeOneIndex == null) {
			return;
		}
		if (nodeTwoIndex == null) {
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

		const nodeOneInfo = {...this.elements[nodeOneIndex]};
		this.elements[nodeOneIndex] = {...this.elements[nodeTwoIndex]};
		this.elements[nodeTwoIndex] = {...nodeOneInfo};
	}

	public getParentNodeIndex(nodeIndex: Index): Index {
		if (nodeIndex === null) {
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

	public getChildNodesIndexes(nodeIndex: Index): [Index, Index] {
		if (nodeIndex === null) {
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

	public getRankFromIndex(nodeIndex: Index): number | null {
		if (nodeIndex === null) {
			return null;
		}
		if (nodeIndex >= this.size()) {
			return null;
		}
		if (nodeIndex < 0) {
			return null;
		}
		if (nodeIndex % 1 !== 0) {
			return null;
		}
		return this.elements[nodeIndex].rank;
	}

	public fixHeap(nodeIndex: Index): void {
		if (this.size() <= 1) {
			return;
		}
		if (nodeIndex === null) {
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

		let nextIndex: Index;
		let isHeapUnbalanced: () => Boolean;
		let getNextIndex: () => Index;

		if (nodeIndex > 0) {
			isHeapUnbalanced = () => {
				let nextRank = this.getRankFromIndex(nextIndex);
				let nodeRank = this.getRankFromIndex(nodeIndex);
				if (nextRank === null) {
					return false;
				}
				if (nodeRank === null) {
					return false;
				}
				if (nodeIndex! <= 0) {
					return false;
				}
				return nextRank > nodeRank;
			};
			getNextIndex = () => {
				return this.getParentNodeIndex(nodeIndex);
			};
		}
		else {
			isHeapUnbalanced = () => {
				let nextRank = this.getRankFromIndex(nextIndex);
				let nodeRank = this.getRankFromIndex(nodeIndex);
				if (nextRank === null) {
					return false;
				}
				if (nodeRank === null) {
					return false;
				}
				return nextRank < nodeRank;
			};
			getNextIndex = () => {
				let childIndexes = this.getChildNodesIndexes(nodeIndex);
				if (childIndexes[0] === null || childIndexes[1] === null) {
					return childIndexes[0];
				}
				let childRanks = [this.getRankFromIndex(childIndexes[0]), this.getRankFromIndex(childIndexes[1])];
				if (childRanks[0] === null) {
					return null;
				}
				if (childRanks[1] === null) {
					return childIndexes[0];
				}
				if (childRanks[0] < childRanks[1]) {
					return childIndexes[0];
				}
				return childIndexes[1];
			};
		}

		nextIndex = getNextIndex() as Index;

		while (isHeapUnbalanced()) {
			this.swapNodes(nodeIndex, nextIndex);
			nodeIndex = nextIndex;
			nextIndex = getNextIndex() as Index;
		}
	}

	public push(element: ArmorPriorityQueueNode<T>): ArmorPriorityQueue<T> {
		this.elements.push(element);
		this.fixHeap(this.size() - 1);
		return this;
	}

	public pop(): ArmorPriorityQueueNode<T> | null {
		if (this.size() === 0) {
			return null;
		}
		if (this.size() === 1) {
			return {...this.elements.shift()} as ArmorPriorityQueueNode<T>;
		}
	
		let highestPriority = {...this.front()};

		this.swapNodes(0, this.size() - 1);
		this.elements.pop();
		this.fixHeap(0);

		return {...highestPriority} as ArmorPriorityQueueNode<T>;
	}
}
