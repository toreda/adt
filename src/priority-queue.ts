import {ArmorCollection} from './collection';
import {ArmorCollectionSelector} from './selector';

export class ArmorPriorityQueue<T> implements ArmorCollection<T> {
	public elements: T[];

	constructor(elements: T[] = []) {
		this.elements = [];
		if (Array.isArray(elements)) {
			elements.forEach(element => {
				this.elements.push(element);
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

	public push(element: any): ArmorPriorityQueue<T> {
		this.elements.push(element);

		if (this.size() > 1) {
			let nodeIndex = this.size() - 1;
			let nodeValue = this.elements[nodeIndex];
			let parentIndex = Math.floor(nodeIndex / 2);
			let parentValue = this.elements[parentIndex];

			while (nodeIndex > 1 && parentValue > nodeValue) {
				this.elements[parentIndex] = nodeValue;
				this.elements[nodeIndex] = parentValue;
				nodeIndex = parentIndex;
				parentIndex = Math.floor(nodeIndex / 2);
				parentValue = this.elements[parentIndex];
			}
		}

		return this;
	}
}
