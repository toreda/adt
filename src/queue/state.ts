/**
 * Internal state data for a specific Queue instance.
 *
 * @category Queue
 */
export interface QueueState<T> {
	elements: Array<T>;
	type: 'Queue';
}
