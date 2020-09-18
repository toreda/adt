import ArmorObjectPoolInstance from './object-pool-instance';

export default interface ArmorObjectPoolState<T> {
	type: 'opState';
	elements: Array<T>;
	autoIncrease: boolean;
	maxSize: number;
	objectCount: number;
	increaseFactor: number;
	increaseBreakPoint: number;
}
