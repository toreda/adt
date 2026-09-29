import {LinkedList} from '../list';
import {LinkedListElement} from './element';
import {type IterableType} from '../../iterable/type';

/**
 * Iterates LinkedList values head to tail.
 *
 * @remarks
 * `next()` allocates nothing: every call returns the same result object,
 * updated in place. Read `value` / `done` before calling `next()` again, as
 * `for...of` and spread do. Keeping a result object across calls sees it
 * change.
 *
 * @category Linked List
 */
export class LinkedListIterator<ItemT> implements Iterator<ItemT | null> {
	private item: LinkedListElement<ItemT> | null;
	/** Result returned by every `next()` call, reused to avoid allocation. */
	private readonly result: IterableType<ItemT | null>;

	constructor(linkedList: LinkedList<ItemT>) {
		this.item = linkedList.head();
		this.result = {value: null, done: false};
	}

	public next(): IterableType<ItemT | null> {
		const result = this.result;

		if (!this.item) {
			result.value = null;
			result.done = true;
			return result;
		}

		result.value = this.item.value();
		result.done = false;
		this.item = this.item.next();

		return result;
	}
}
