import {ArmorObjectPoolOptions} from './object-pool-options';
import {ArmorObjectPoolState} from './object-pool-state';

export class ArmorObjectPool<T> {
	public readonly state: ArmorObjectPoolState;

	constructor(options?: ArmorObjectPoolOptions) {
		this.state = new ArmorObjectPoolState(options);
	}
}
