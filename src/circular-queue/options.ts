export interface ADTCircularQueueOptions<T> {
	serializedState?: string;

	elements?: T[];
	overwrite?: boolean;
	size?: number;
	maxSize?: number;
	front?: number;
	rear?: number;
}
