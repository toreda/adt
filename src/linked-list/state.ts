import {ADTLinkedListElement} from './element';

export interface ADTLinkedListState<T> {
	elements: Array<T | null>;
	head: ADTLinkedListElement<T> | null;
	size: number;
	tail: ADTLinkedListElement<T> | null;
	type: 'LinkedList';
}
