import {type DataStructureOptions} from '../../data/structure/options';

/**
 * Optional config provided to the PriorityQueue constructor.
 *
 * The pooling entries from `DataStructureOptions` have no effect: the queue
 * stores items directly in its heap array and allocates no element wrappers.
 *
 * @category Priority Queue
 */
export interface PriorityQueueOptions<T> extends DataStructureOptions {
	/** Populates the queue with these elements upon instantiation. They are heapified. */
	elements?: Array<T>;
}
