import ArmorObjectPoolInstance from './object-pool-instance';

export default interface ArmorObjectPoolState<T> {
	type: 'opState';
	elements: Array<T>;
	maxSize: number;
	autoIncrease: boolean;
}