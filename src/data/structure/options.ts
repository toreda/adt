import {type ObjectPoolOptions} from '../../object/pool/options';

/**
 * Options shared by every data structure's options interface, except `ObjectPoolOptions`
 * itself. Options are always optional: nothing here is ever required.
 *
 * @category Base
 */
export interface DataStructureOptions {
	/**
	 * Element pooling is on by default: the data structure keeps an internal `ObjectPool`
	 * of its own element wrappers and recycles them on removal, so steady-state
	 * inserts allocate nothing. Only the strict boolean `true` disables it; any
	 * other value leaves pooling on.
	 *
	 * @remarks
	 * With pooling on, an element wrapper handed out by the data structure is invalid once
	 * it has been removed: it may be reissued to a later insert. Read removed
	 * values from the removal method's return instead of a retained wrapper.
	 */
	disableElementPooling?: boolean;
	/**
	 * Config for the internal `ObjectPool`, passed through when pooling is on
	 * and ignored otherwise. Entries override the data structure's own pool defaults, which
	 * start the pool empty and let it grow with demand.
	 */
	pool?: ObjectPoolOptions | null;
}
