import {type DataStructureOptions} from '../../data/structure/options';

/**
 * Optional config provided to the CircularQueue constructor. Options are
 * always optional, so nothing here is ever required: every entry falls back to
 * its default when missing or invalid, and invalid values never throw.
 *
 * The pooling entries from `DataStructureOptions` have no effect: the queue stores items
 * directly in its ring buffer and allocates no element wrappers.
 *
 * @category Circular Queue
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface CircularQueueOptions<ItemT> extends DataStructureOptions {
	/**
	 * Capacity of the queue. Must be a positive integer; defaults to `25`.
	 * The ring buffer allocates all `maxSize` slots at construction, so pick a
	 * real bound rather than a very large number.
	 */
	maxSize?: number;
	/**
	 * When `true`, adding to a full queue overwrites the element at the
	 * opposite end instead of failing. Only a strict boolean is accepted;
	 * defaults to `false`.
	 */
	overwrite?: boolean;
}
