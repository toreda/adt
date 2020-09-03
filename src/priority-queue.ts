import {ArmorCollection} from './collection';
import {ArmorCollectionSelector} from './selector';

type Index = number | null;

interface ArmorPriorityQueueNode<T> {
	rank: number;
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

	public swapNodes(node1Index: Index, node2Index: Index): void {
		if (node1Index == null) {
			return;
		}
		if (node2Index == null) {
			return;
		}
		if (node1Index < 0) {
			return;
		}
		if (node2Index < 0 ) {
			return;
		}
		if (node1Index >= this.size() ) {
			return;
		}
		if (node2Index >= this.size() ) {
			return;
		}
		const node1Info = {...this.elements[node1Index]};
		this.elements[node1Index] = {...this.elements[node2Index]};
		this.elements[node2Index] = {...node1Info};
	}

	public getParentNodeIndex(nodeIndex: Index): Index {
		if (nodeIndex === null) {
			return null;
		}
		if (nodeIndex === 0) {
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

	public getRankFromIndex(nodeIndex: Index): number {
		if (nodeIndex === null) {
			return 0;
		}
		if (nodeIndex >= this.size()) {
			return 0;
		}
		return this.elements[nodeIndex].rank;
	}

	public push(element: ArmorPriorityQueueNode<T>): ArmorPriorityQueue<T> {
		this.elements.push(element);

		if (this.size() > 1) {
			let nodeIndex: Index = this.size() - 1;
			let parentIndex = this.getParentNodeIndex(nodeIndex);
			let indexesAreValid = parentIndex !== null && nodeIndex !== null && nodeIndex > 0;
			let parentHasLargerRank = (parentIndex !== null && nodeIndex !== null) && this.getRankFromIndex(parentIndex) > this.getRankFromIndex(nodeIndex);

			while (indexesAreValid && parentHasLargerRank) {
				this.swapNodes(nodeIndex, parentIndex);
				nodeIndex = parentIndex;
				parentIndex = this.getParentNodeIndex(nodeIndex);
				indexesAreValid = parentIndex !== null && nodeIndex !== null && nodeIndex > 0;
				parentHasLargerRank = (parentIndex !== null && nodeIndex !== null) && this.getRankFromIndex(parentIndex) > this.getRankFromIndex(nodeIndex);
			}
		}

		return this;
	}

	public pop(): ArmorPriorityQueueNode<T> | null {
		if (this.size() === 0) {
			return null;
		}
		if (this.size() === 1) {
			return {...this.elements.shift()} as ArmorPriorityQueueNode<T>;
		}
		if (this.size() === 3) {
			let highestPriority = {...this.elements.shift()};
			if (this.getRankFromIndex(0) > this.getRankFromIndex(1)) {
				this.swapNodes(0, 1);
			}
			return {...highestPriority} as ArmorPriorityQueueNode<T>;
		}
		
		let highestPriority = {...this.front()};

		this.swapNodes(0, this.size() - 1);
		this.elements.pop();

		if (this.size() === 1) {
			return {...highestPriority} as ArmorPriorityQueueNode<T>;
		}

		let nodeIndex: Index = 0;
		let childIndexes = this.getChildNodesIndexes(nodeIndex);
		let ranksAreValid = this.getRankFromIndex(nodeIndex) > 0 && this.getRankFromIndex(childIndexes[0]) > 0 && this.getRankFromIndex(childIndexes[1]) > 0;
		let childHasSmallerRank = this.getRankFromIndex(childIndexes[0]) < this.getRankFromIndex(nodeIndex) || this.getRankFromIndex(childIndexes[1]) < this.getRankFromIndex(nodeIndex);

		while (ranksAreValid && childHasSmallerRank) {
			if (this.getRankFromIndex(childIndexes[0]) < this.getRankFromIndex(childIndexes[1])) {
				this.swapNodes(nodeIndex, childIndexes[0]);
				nodeIndex = childIndexes[0];
			}
			else {
				this.swapNodes(nodeIndex, childIndexes[1]);
				nodeIndex = childIndexes[1];
			}
			childIndexes = this.getChildNodesIndexes(nodeIndex);
			ranksAreValid = this.getRankFromIndex(nodeIndex) > 0 && this.getRankFromIndex(childIndexes[0]) > 0 && this.getRankFromIndex(childIndexes[1]) > 0;
			childHasSmallerRank = this.getRankFromIndex(childIndexes[0]) < this.getRankFromIndex(nodeIndex) || this.getRankFromIndex(childIndexes[1]) < this.getRankFromIndex(nodeIndex);
		}

		ranksAreValid = this.getRankFromIndex(nodeIndex) > 0 && this.getRankFromIndex(childIndexes[0]) > 0 && this.getRankFromIndex(childIndexes[1]) === 0;
		childHasSmallerRank = this.getRankFromIndex(childIndexes[0]) < this.getRankFromIndex(nodeIndex);
		if (ranksAreValid && childHasSmallerRank) {
			this.swapNodes(nodeIndex, childIndexes[0]);
		}

		return {...highestPriority} as ArmorPriorityQueueNode<T>;
	}
}
