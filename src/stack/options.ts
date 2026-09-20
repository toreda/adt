/**
 * Optional values used by Stack constructor.
 * 
 * @category Stack
 */
export interface StackOptions<ItemT> {
	/** Populates the Stack with these elements upon instantiation. */
	elements?: Array<ItemT>;
	serializedState?: string;
}
