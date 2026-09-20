/** 
 * @category Priority Queue
 */
export interface PriorityQueueComparator<ItemT> {
	(a: ItemT, b: ItemT): boolean;
}
