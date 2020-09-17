import ArmorObjectPoolState from './object-pool-state';

export default interface ArmorObjectPoolOptions<T> {
	state?: ArmorObjectPoolState<T>;
	serializedState?: string;
	startSize?: number;
}