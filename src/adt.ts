import {Element} from './element';
import {QueryFilter} from './query/filter';
import {QueryOptions} from './query/options';
import {QueryResult} from './query/result';

/**
 * @category Base
 */
export interface ADT<T> {
	clearElements(): void;
	reset(): void;
	stringify(): string | null;
	query(
		query: QueryFilter<T> | QueryFilter<T>[],
		options?: QueryOptions
	): QueryResult<T>[] | QueryResult<Element<T>>[];
}
