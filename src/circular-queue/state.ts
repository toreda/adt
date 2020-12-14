export interface ADTCircularQueueState<T> {
	elements: T[];
	front: number;
	maxSize: number;
	overwrite: boolean;
	rear: number;
	size: number;
	type: 'CircularQueue';
}
