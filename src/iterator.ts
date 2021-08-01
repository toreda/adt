import {IterableType} from './iterable/type';

/**
 * Base contract for ADTs which return Iterators. ADTs may also
 * extend this contract to add implementation-specific data.
 *
 * @category Base
 */
export interface Iterator<ItemT> {
	next: () => IterableType<ItemT>;
}
