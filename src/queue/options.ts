/**
 * Optional config provided to the Queue constructor. Options are always
 * optional: every entry falls back to its default when missing or invalid, and
 * invalid values never throw.
 *
 * @category Queue
 */
export interface QueueOptions<ItemT> {
	/**
	 * Items copied into the queue front to rear. Ignored when not an array.
	 */
	elements?: Array<ItemT>;
}
