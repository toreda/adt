export interface ADTPriorityQueueComparator<T> {
	(a: T, b: T): boolean;
}
