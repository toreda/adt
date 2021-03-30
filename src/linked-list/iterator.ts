import {ADTLinkedList} from '../linked-list';
import {ADTLinkedListElement as Element} from '../linked-list/element';
import {IterableType} from '../iterable-type';

export class LinkedListIterator<ItemT> implements Iterator<ItemT | null> {
	private item: Element<ItemT> | null;

	constructor(linkedList: ADTLinkedList<ItemT>) {
		this.item = linkedList.head();
	}

	next(): IterableType<ItemT | null> {
		if (this.item == null) {
			return {
				value: null,
				done: true
			};
		}
		const value = this.item.value();
		this.item = this.item.next();
		return {value: value, done: false};
	}
}
