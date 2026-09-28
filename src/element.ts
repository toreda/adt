/**
 * Base contract which defining the minimum method and properties
 * required for data structure elements. Each data structure further extends this interface
 * to add implementation specific data.
 *
 * @category Base
 */
export interface Element<T> {
	value(elementValue?: T): T | null;
}
