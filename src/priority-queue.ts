import {ArmorCollection} from './collection';
import {ArmorCollectionSelector} from './selector';

export class ArmorPriorityQueue<T> implements ArmorCollection<T> {
	public elements: T[];

	constructor(elements: T[] = []) {
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

	public push(element: any): ArmorPriorityQueue<T> {
		this.elements.push(element);

		if (this.size() > 1) {
			let nodeIndex = this.size() - 1;
			let nodeValue = this.elements[nodeIndex];
			let parentIndex = Math.floor((nodeIndex - 1) / 2);
			let parentValue = this.elements[parentIndex];

			while (nodeIndex > 0 && parentValue > nodeValue) {
				this.elements[parentIndex] = nodeValue;
				this.elements[nodeIndex] = parentValue;
				nodeIndex = parentIndex;
				parentIndex = Math.floor((nodeIndex - 1) / 2);
				parentValue = this.elements[parentIndex];
			}
		}

		return this;
	}

	public front(): T | null {
		return this.elements[0] || null;
	}

	public pop(): T | null {
		if (this.size() == 0) {
			return null;
		}
		else if (this.size() == 1) {
			return this.elements.shift() || null;
		}
		else {
			let highestPriority = this.front();

			if (this.size() === 3) {
				highestPriority = this.elements.shift() || null;
				if (this.elements[0] > this.elements[1]){
					let lastValue = this.elements[1];
					this.elements[1] = this.elements[0];
					this.elements[0] = lastValue;
				}
				return highestPriority;
			}

			let nodeIndex = 0;
			let nodeValue = this.front();
			let lastIndex = this.size() - 1;
			let lastValue = this.elements.pop();

			if (lastValue) this.elements[nodeIndex] = lastValue;

			if (lastValue) nodeValue = lastValue;
			let childLeftIndex = nodeIndex * 2 + 1;
			let childLeftValue = this.elements[childLeftIndex] || null;
			let childRghtIndex = nodeIndex * 2 + 2;
			let childRghtValue = this.elements[childRghtIndex] || null;

			while (nodeValue && childLeftValue && childRghtValue &&
						(childLeftValue < nodeValue || childRghtValue < nodeValue)
						) {
				if (childLeftValue < childRghtValue) {
					this.elements[nodeIndex] = childLeftValue;
					this.elements[childLeftIndex] = nodeValue;
					nodeIndex = childLeftIndex;
				}
				else {
					this.elements[nodeIndex] = childRghtValue;
					this.elements[childRghtIndex] = nodeValue;
					nodeIndex = childRghtIndex;
				}
				childLeftIndex = nodeIndex * 2 + 1;
				childRghtIndex = nodeIndex * 2 + 2;
				childLeftValue = this.elements[childLeftIndex] || null;
				childRghtValue = this.elements[childRghtIndex] || null;
			}

			if (childRghtValue === null && childLeftValue && nodeValue && childLeftValue < nodeValue) {
				this.elements[nodeIndex] = childLeftValue;
				this.elements[childLeftIndex] = nodeValue;
			}

			return highestPriority;
		}
	}
}
