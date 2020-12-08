export interface ADTObjectPoolState<T> {
	type: 'opState';

	pool: T[];
	used: (T | null)[];

	startSize: number;
	objectCount: number;
	maxSize: number;

	autoIncrease: boolean;
	increaseBreakPoint: number;
	increaseFactor: number;

	instanceArgs: unknown[];
}
