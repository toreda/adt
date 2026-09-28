import type {IterableType} from './iterable/type';

/**
 * Base contract for data structures which return Iterators. Data structures may also
 * extend this contract to add implementation-specific data.
 *
 * @category Base
 */
export interface Iterator<ItemT> {
	next: () => IterableType<ItemT>;
}
