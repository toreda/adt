export interface ADTQueueState<T> {
	deepClone?: boolean;
	elements: Array<T>;
	objectPool?: boolean;
	type: 'Queue';
}
