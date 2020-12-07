export interface ADTObjectPoolState<T> {
	type: 'opState';
	elements: Array<T>;

	autoIncrease: boolean;

	startSize: number;
	objectCount: number;
	maxSize: number;

	increaseBreakPoint: number;
	increaseFactor: number;

	instanceArgs: any[];
}
