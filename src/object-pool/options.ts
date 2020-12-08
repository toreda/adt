export interface ADTObjectPoolOptions {
	serializedState?: string;

	autoIncrease?: boolean;
	startSize?: number;
	maxSize?: number;
	increaseBreakPoint?: number;
	increaseFactor?: number;

	instanceArgs?: unknown[];
}
