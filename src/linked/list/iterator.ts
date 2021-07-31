import {LinkedList} from '../list';
import {LinkedListElement as Element} from './element';
import {IterableType} from '../../iterable-type';
import {makeIterableType} from '../../makeIterableType';

/**
 * @category LinkedList
 */
export class LinkedListIterator<ItemT> implements Iterator<ItemT | null> {
	private item: Element<ItemT> | null;

	constructor(linkedList: LinkedList<ItemT>) {
		this.item = linkedList.head();
	}

	next(): IterableType<ItemT | null> {
		if (!this.item) {
			return makeIterableType(null, true);
		}

		const value = this.item.value();
		this.item = this.item.next();

		return makeIterableType(value, false);
	}
}
