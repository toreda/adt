import ArmorObjectPoolInstance from './object-pool-instance';

export default interface ArmorObjectPoolState<T> {
	type: 'opState';
	elements: Array<T>;
	objectCount: number;
	maxSize: number;
	autoIncrease: boolean;
	increaseFactor: number;
	increaseBreakPoint: number;
}
