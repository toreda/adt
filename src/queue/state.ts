/**
 * Shape of the JSON produced by `Queue.stringify()`: the queue's items, front
 * to rear.
 *
 * @category Queue
 */
export interface QueueState<ItemT> {
	elements: Array<ItemT>;
	type: 'Queue';
}
