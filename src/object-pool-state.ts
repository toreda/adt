import ArmorObjectPoolInstance from './object-pool-instance';

export default interface ArmorObjectPoolState<T> {
	type: 'opState';
	elements: Array<T>;

	autoIncrease: boolean;
	
	startSize: number;
	objectCount: number;
	maxSize: number;
	
	increaseBreakPoint: number;
	increaseFactor: number;
}
