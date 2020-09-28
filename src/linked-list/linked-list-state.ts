import ADTLinkedListElement from './linked-list-element';

export default interface ADTLinkedListState<T> {
	type: 'llState';
	elements: T[];
	objectPool: boolean;
	size: number;
	head: ADTLinkedListElement<T> | null;
	tail: ADTLinkedListElement<T> | null;
}
