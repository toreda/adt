/**
 * @category ObjectPool
 */
export interface ObjectPoolOptions {
	autoIncrease?: boolean;
	increaseBreakPoint?: number;
	increaseFactor?: number;
	instanceArgs?: unknown[];
	maxSize?: number;
	serializedState?: string;
	startSize?: number;
}
