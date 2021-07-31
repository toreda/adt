/**
 * @category ObjectPool
 */
export interface ObjectPoolConstructor<T> {
	new (...args: unknown[]): T;
}
