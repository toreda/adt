import {type Element} from './element';
import {type QueryFilter} from './query/filter';
import {type QueryOptions} from './query/options';
import {type QueryResult} from './query/result';

/**
 * Core interface every collection in this package implements. Byte encoding
 * is not part of this contract: see `ByteADT`, implemented by the byte
 * subclass of each collection.
 *
 * @category Base
 */
export interface ADT<ItemT> {
	clearElements(): void;
	reset(): void;
	stringify(): string | null;
	query(
		query: QueryFilter<ItemT> | QueryFilter<ItemT>[],
		options?: QueryOptions
	): QueryResult<ItemT>[] | QueryResult<Element<ItemT>, ItemT>[];
}
