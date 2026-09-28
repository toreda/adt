import {type Element} from '../element.js';
import {type QueryFilter} from '../query/filter.js';
import {type QueryOptions} from '../query/options.js';
import {type QueryResult} from '../query/result.js';

/**
 * Core interface every collection in this package implements. Byte encoding
 * is not part of this contract: see `ByteDataStructure`, implemented by the byte
 * subclass of each collection.
 *
 * @category Base
 */
export interface DataStructure<ItemT> {
	clearElements(): void;
	reset(): void;
	stringify(): string | null;
	query(
		query: QueryFilter<ItemT> | QueryFilter<ItemT>[],
		options?: QueryOptions
	): QueryResult<ItemT>[] | QueryResult<Element<ItemT>, ItemT>[];
}
