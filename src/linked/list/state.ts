import {LinkedListElement} from './element';

/**
 * @category LinkedList
 */
export interface LinkedListState<T> {
	/** Elements stored in Linked List. */
	elements: T[];
	/** First element in Linked List. */
	head: LinkedListElement<T> | null;
	/** Number of elements in Linked List. */
	size: number;
	/** Last element in Linked List. */
	tail: LinkedListElement<T> | null;
	/** ADT Type used for runtime typing. */
	type: 'LinkedList';
}
