import ArmorObjectPoolClearData from './object-pool-clearData';
import ArmorObjectPoolState from './object-pool-state';

export default interface ArmorObjectPoolOptions<T> {
	state: ArmorObjectPoolState<T> | string;
}