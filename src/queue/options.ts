export interface ADTQueueOptions<T> {
	deepClone?: boolean;
	elements?: Array<T>;
	objectPool?: boolean;
	serializedState?: string;
}
