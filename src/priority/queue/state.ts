/**
 * Shape of the JSON produced by `PriorityQueue.stringify()`: the live
 * elements in heap array order.
 *
 * @category Priority Queue
 */
export interface PriorityQueueState<T> {
	elements: T[];
	type: 'PriorityQueue';
}
