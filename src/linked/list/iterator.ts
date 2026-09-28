import {LinkedList} from '../list.js';
import {LinkedListElement} from './element.js';
import {type IterableType} from '../../iterable/type.js';
import {iterableMakeType} from '../../iterable/helpers.js';

/**
 * @category Linked List
 */
export class LinkedListIterator<ItemT> implements Iterator<ItemT | null> {
	private item: LinkedListElement<ItemT> | null;

	constructor(linkedList: LinkedList<ItemT>) {
		this.item = linkedList.head();
	}

	public next(): IterableType<ItemT | null> {
		if (!this.item) {
			return iterableMakeType(null, true);
		}

		const value = this.item.value();
		this.item = this.item.next();

		return iterableMakeType(value, false);
	}
}
