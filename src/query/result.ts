/**
 * Single match returned by an ADT's query().
 *
 * @typeParam T		Type of the matched element.
 * @typeParam V		Type returned by delete(). Defaults to T. Differs when the ADT
 * 					wraps values, e.g. LinkedList matches Element<T> but deletes to T.
 *
 * @category Query
 */
export interface QueryResult<T, V = T> {
	element: T;
	/** Remove the matched element from its ADT. Returns the removed value, or null if it is no longer present. */
	delete: () => V | null;
	index: () => number | null;
	key: () => string | null;
}
