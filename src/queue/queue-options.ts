export interface ADTQueueOptions<T> {
	serializedState?: string;
	elements?: Array<T>;
	objectPool?: boolean;
	deepClone?: boolean;
}
