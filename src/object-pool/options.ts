export interface ADTObjectPoolOptions {
	serializedState?: string;

	startSize?: number;
	maxSize?: number;

	autoIncrease?: boolean;
	increaseBreakPoint?: number;
	increaseFactor?: number;

	instanceArgs?: unknown[];
}
