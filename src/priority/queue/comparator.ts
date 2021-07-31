/**
 * @category Priority Queue
 */
export interface PriorityQueueComparator<T> {
	(a: T, b: T): boolean;
}
