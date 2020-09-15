import ArmorObjectPoolClearData from './object-pool-clearData';
import ArmorObjectPoolOptions from './object-pool-options';
import ArmorObjectPoolState from './object-pool-state';

export default class ArmorObjectPool<T> {
	public readonly state: ArmorObjectPoolState<T>;

	constructor(elements: Array<T>, clearData: ArmorObjectPoolClearData<T>,options?: ArmorObjectPoolOptions<T>) {
	}
}
