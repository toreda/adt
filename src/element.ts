/**
 * Base contract which defining the minimum method and properties
 * required for ADT Elements. Each ADT further extends this interface
 * to add implementation specific data.
 *
 * @category Base
 */
export interface Element<T> {
	value(elementValue?: T): T | null;
}
