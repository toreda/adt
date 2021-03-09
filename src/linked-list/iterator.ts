import {ADTLinkedList} from '../linked-list';
import {IterableType} from '../iterable-type';

export class LinkedListIterator<ItemT> implements Iterator<ItemT | null> {
	public curr: number;
	public readonly linkedList: ADTLinkedList<ItemT>;

	constructor(linkedList: ADTLinkedList<ItemT>) {
		this.linkedList = linkedList;
		this.curr = 0;
	}
	next(): IterableType<ItemT | null> {
		if (!this.linkedList.size() || this.curr >= this.linkedList.size()) {
			return {
				value: null,
				done: true
			};
		}
		const value = this.linkedList.state.elements[this.curr];
		this.curr++;
		return {value: value, done: false};
	}
}
