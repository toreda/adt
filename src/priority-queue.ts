import {ArmorCollection} from './collection';
import {ArmorCollectionSelector} from './selector';

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
		return this.elements.length;
	}

	public front(): ArmorPriorityQueueNode<T> | null {
		return this.elements[0] || null;
	}

	public push(element: ArmorPriorityQueueNode<T>): ArmorPriorityQueue<T> {
		this.elements.push(element);

		if (this.size() > 1) {
			let nodeIndex = this.size() - 1;
			let nodeRank = this.elements[nodeIndex].rank;
			let nodeData = this.elements[nodeIndex].data;
			let parentIndex = Math.floor((nodeIndex - 1) / 2);
			let parentRank = this.elements[parentIndex].rank;
			let parentData = this.elements[parentIndex].data;

			while (nodeIndex > 0 && parentRank > nodeRank) {
				this.elements[parentIndex].rank = nodeRank;
				this.elements[parentIndex].data = nodeData;
				this.elements[nodeIndex].rank = parentRank;
				this.elements[nodeIndex].data = parentData;
				nodeIndex = parentIndex;
				parentIndex = Math.floor((nodeIndex - 1) / 2);
				if ( parentIndex >= 0 ) {
					parentRank = this.elements[parentIndex].rank;
					parentData = this.elements[parentIndex].data;
					}
			}
		}

		return this;
	}

	public pop(): ArmorPriorityQueueNode<T> | null {
		if (this.size() === 0) {
			return null;
		}
		else if (this.size() === 1) {
			return {...this.elements.shift()} as ArmorPriorityQueueNode<T>;
		}
		else {
			let highestPriority = {...this.front()} as ArmorPriorityQueueNode<T>;;

			if (this.size() === 3) {
				highestPriority = {...this.elements.shift()} as ArmorPriorityQueueNode<T>;
				if ((this.elements[0] as ArmorPriorityQueueNode<T>).rank > (this.elements[1] as ArmorPriorityQueueNode<T>).rank) {
					let lastValue = {...this.elements[1]};
					this.elements[1] = {...this.elements[0]};
					this.elements[0] = {...lastValue};
				}
				return {...highestPriority};
			}

			let nodeIndex = 0;
			let nodeValue = {...this.front()} as ArmorPriorityQueueNode<T>;
			let nodeRank = nodeValue.rank;
			let nodeData = nodeValue.data;
			let lastIndex = this.size() - 1;
			let lastValue = {...this.elements.pop()} as ArmorPriorityQueueNode<T>;
			let lastRank = lastValue.rank;
			let lastData = lastValue.data;

			this.elements[nodeIndex] = {rank: lastRank, data: lastData}

			if (this.size() === 1) {
				return {...highestPriority};
			}

			nodeRank = lastRank;
			nodeData = lastData;
			let childLeftIndex = nodeIndex * 2 + 1;
			let childLeftRank = this.elements[childLeftIndex].rank;
			let childLeftData = this.elements[childLeftIndex].data;
			let childRghtIndex = nodeIndex * 2 + 2;
			let childRghtRank = this.elements[childRghtIndex].rank;
			let childRghtData = this.elements[childRghtIndex].data;

			while (nodeRank && childLeftRank && childRghtRank &&
						(childLeftRank < nodeRank || childRghtRank < nodeRank)
						) {
				if (childLeftRank < childRghtRank) {
					this.elements[nodeIndex] = {rank: childLeftRank, data: childLeftData};
					this.elements[childLeftIndex] = {rank: nodeRank, data: nodeData};
					nodeIndex = childLeftIndex;
				}
				else {
					this.elements[nodeIndex] = {rank: childRghtRank, data: childRghtData};
					this.elements[childRghtIndex] = {rank: nodeRank, data: nodeData};
					nodeIndex = childRghtIndex;
				}
				childLeftIndex = nodeIndex * 2 + 1;
				if (childLeftIndex >= this.size()) {
					childLeftRank = 0;
				}
				else {
					childLeftRank = this.elements[childLeftIndex].rank;
					childLeftData = this.elements[childLeftIndex].data;
					}
				childRghtIndex = nodeIndex * 2 + 2;
				if (childRghtIndex >= this.size()) {
					childRghtRank = 0;
				}
				else {
					childRghtRank = this.elements[childRghtIndex].rank;
					childRghtData = this.elements[childRghtIndex].data;
				}
			}

			if (!childRghtRank && childLeftRank && nodeRank && childLeftRank < nodeRank) {
				this.elements[nodeIndex] = {rank: childLeftRank, data: childLeftData};
				this.elements[childLeftIndex] = {rank: nodeRank, data: nodeData};
			}

			return {...highestPriority};
		}
	}
}
