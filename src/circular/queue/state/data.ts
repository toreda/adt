/**
 * @category Circular Queue
 */
export interface CircularQueueStateData<ItemT> {
	elements: ItemT[];
	front: number;
	maxSize: number;
	overwrite: boolean;
	rear: number;
	size: number;
	type: 'CircularQueue';
}
