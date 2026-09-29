import {type DataStructureOptions} from '../data/structure/options';

/**
 * Optional config provided to the Queue constructor. Options are always
 * optional: every entry falls back to its default when missing or invalid, and
 * invalid values never throw.
 *
 * The pooling entries from `DataStructureOptions` have no effect: the queue
 * stores items directly in its ring buffer and allocates no element wrappers.
 *
 * @category Queue
 */
export interface QueueOptions<ItemT> extends DataStructureOptions {
	/**
	 * Items copied into the queue front to rear. Ignored when not an array.
	 */
	elements?: Array<ItemT>;
}
