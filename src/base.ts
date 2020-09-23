import ADTBaseElement from './base-element';
import ADTQueryFilter from './query-filter';
import ADTQueryOptions from './query-options';
import ADTQueryResult from './query-result';

export default interface ADTBase<T> {
	clearElements(): void;
	reset(): void;
	parse(s: string): any | Array<string> | null;
	stringify(): string | null;
	query(query: ADTQueryFilter | ADTQueryFilter[], options?: ADTQueryOptions): ADTQueryResult<T>[] | ADTQueryResult<ADTBaseElement<T>>[];
}
