import type {LinkedList} from '../list';
import type {LinkedListElement} from './element';

/**
 * Callback signature for LinkedList `forEach` and `filter`. Mirrors the
 * `Map` / `Set` callbacks: the third argument is the list being walked,
 * not an array.
 *
 * @typeParam ItemT		Item type held by the list.
 * @typeParam U			Callback return type.
 *
 * @category Linked List
 */
export type LinkedListMethod<ItemT, U> = (
	element: LinkedListElement<ItemT>,
	index: number,
	list: LinkedList<ItemT>
) => U;
