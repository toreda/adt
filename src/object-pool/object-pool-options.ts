export interface ADTObjectPoolOptions<T> {
	serializedState?: string;

	autoIncrease?: boolean;
	startSize?: number;
	maxSize?: number;
	increaseBreakPoint?: number;
	increaseFactor?: number;
}
