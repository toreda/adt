/**
 * Optional list config options provided to LinkedList constructor
 * on creation to populate the list's internal starting state.
 * State is populated with default values for any options not provided.
 *
 * @category Linked List
 */
export interface LinkedListOptions<T> {
	/** Elements to be inserted into list on creation. */
	elements?: T[];
	serializedState?: string;
}
