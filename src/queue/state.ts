export interface ADTQueueState<T> {
	type: 'Queue';
	elements: Array<T>;
	deepClone?: boolean;
	objectPool?: boolean;
}
