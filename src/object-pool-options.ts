import ArmorObjectPoolState from './object-pool-state';

export default interface ArmorObjectPoolOptions<T> {
	serializedState?: string;

	autoIncrease?: boolean;
	startSize?: number;
	maxSize?: number;
	increaseBreakPoint?: number;
	increaseFactor?: number;
}