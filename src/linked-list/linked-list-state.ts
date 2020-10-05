import {ADTLinkedListElement} from './linked-list-element';

export interface ADTLinkedListState<T> {
	type: 'llState';
	elements: T[];
	objectPool: boolean;
	size: number;
	head: ADTLinkedListElement<T> | null;
	tail: ADTLinkedListElement<T> | null;
}
