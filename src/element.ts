/**
 * @category Base
 */
export interface Element<T> {
	value(elementValue?: T): T | null;
}
