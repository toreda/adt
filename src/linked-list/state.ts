import {ADTLinkedListElement} from './element';

export interface ADTLinkedListState<T> {
	elements: T[];
	head: ADTLinkedListElement<T> | null;
	objectPool: boolean;
	size: number;
	tail: ADTLinkedListElement<T> | null;
	type: 'LinkedList';
}
