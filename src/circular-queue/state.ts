export interface ADTCircularQueueState<T> {
	type: 'CircularQueue';
	elements: T[];
	overwrite: boolean;
	size: number;
	maxSize: number;
	front: number;
	rear: number;
}
