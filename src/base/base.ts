import {ADTBaseElement} from './base-element';
import {ADTQueryFilter} from '../query/query-filter';
import {ADTQueryOptions} from '../query/query-options';
import {ADTQueryResult} from '../query/query-result';

export interface ADTBase<T> {
	clearElements(): void;
	reset(): void;
	stringify(): string | null;
	query(
		query: ADTQueryFilter<T> | ADTQueryFilter<T>[],
		options?: ADTQueryOptions
	): ADTQueryResult<T>[] | ADTQueryResult<ADTBaseElement<T>>[];
}
