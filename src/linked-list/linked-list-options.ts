export default interface ADTLinkedListOptions<T> {
	serializedState?: string;
	objectPool?: boolean;
	elements?: T[];
}