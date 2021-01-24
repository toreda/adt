export interface ADTObjectPoolState<T> {
	autoIncrease: boolean;
	increaseBreakPoint: number;
	increaseFactor: number;
	instanceArgs: unknown[];
	maxSize: number;
	objectCount: number;
	pool: T[];
	startSize: number;
	type: 'ObjectPool';
	used: (T | null)[];
}
