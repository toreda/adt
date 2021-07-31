import {IterableType} from './iterable/type';

/**
 * @category Base
 */
export interface Iterator<ItemT> {
	next: () => IterableType<ItemT>;
}
