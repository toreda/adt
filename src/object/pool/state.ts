/**
 * @category Object Pool
 */
export interface ObjectPoolState<T> {
	autoIncrease: boolean;
	increaseBreakPoint: number;
	increaseFactor: number;
	instanceArgs: unknown[];
	maxSize: number;
	/** Total objects the pool has constructed and still owns, free or in use. */
	objectCount: number;
	/**
	 * Free objects, a stack in slots `0` to `freeCount - 1`. Slots past `freeCount`
	 * are `null`. The array keeps its high-water length so allocate and release
	 * never resize it.
	 */
	pool: (T | null)[];
	/** Number of free objects at the front of `pool`. */
	freeCount: number;
	startSize: number;
	type: 'ObjectPool';
	/**
	 * In-use objects, dense in slots `0` to `usedCount - 1`. Slots past `usedCount`
	 * are `null`. Release swaps the last in-use object into the freed slot, so
	 * order is not allocation order.
	 */
	used: (T | null)[];
	/** Number of in-use objects at the front of `used`. */
	usedCount: number;
}
