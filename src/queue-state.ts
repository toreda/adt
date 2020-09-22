export default interface ADTQueueState<T> {
	type: 'qState';
	elements: Array<T>;
	deepClone?: boolean;
	objectPool?: boolean;
}
