/**
 * @category Query
 */
export interface QueryFilter<T> {
	(value: T): boolean;
}
