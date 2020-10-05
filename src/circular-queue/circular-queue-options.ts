export interface ADTCircularQueueOptions<T> {
	serializedState?: string;

	elements?: [];
	overwrite?: boolean;
	size?: number;
	maxSize?: number;
	front?: number;
	rear?: number;
}
