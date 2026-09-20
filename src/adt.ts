import {Element} from './element';
import {type QueryFilter} from './query/filter';
import {type QueryOptions} from './query/options';
import {type QueryResult} from './query/result';

/**
 * Core inter
 *
 * @category Base
 */
export interface ADT<T> {
	clearElements(): void;
	reset(): void;
	stringify(): string | null;
	toBinary(): Uint32Array | null;
	query(
		query: QueryFilter<T> | QueryFilter<T>[],
		options?: QueryOptions
	): QueryResult<T>[] | QueryResult<Element<T>>[];
}
