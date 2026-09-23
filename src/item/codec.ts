import {type ItemDecoder} from './decoder';
import {type ItemEncoder} from './encoder';

/**
 * Caller supplied pair converting a single item to and from its byte form.
 * Items are generic, so every byte ADT requires one at construction.
 *
 * @category Base
 */
export interface ItemCodec<ItemT> {
	encode: ItemEncoder<ItemT>;
	decode: ItemDecoder<ItemT>;
}
