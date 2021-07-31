import {LinkedList} from '../list';
import {LinkedListElement as Element} from './element';
import {IterableType} from '../../iterable/type';
import {iterableMakeType} from '../../iterable/helpers';

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
			return iterableMakeType(null, true);
		}

		const value = this.item.value();
		this.item = this.item.next();

		return iterableMakeType(value, false);
	}
}
