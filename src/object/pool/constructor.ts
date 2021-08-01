/**
 * @category Object Pool
 */
export interface ObjectPoolConstructor<T> {
	new (...args: unknown[]): T;
}
