export interface ADTCircularQueueOptions<T> {
	elements?: T[];
	front?: number;
	maxSize?: number;
	overwrite?: boolean;
	rear?: number;
	serializedState?: string;
	size?: number;
}
