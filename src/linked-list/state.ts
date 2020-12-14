import {ADTLinkedListElement} from './element';

export interface ADTLinkedListState<T> {
	type: 'LinkedList';
	elements: T[];
	objectPool: boolean;
	size: number;
	head: ADTLinkedListElement<T> | null;
	tail: ADTLinkedListElement<T> | null;
}
