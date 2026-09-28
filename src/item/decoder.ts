/**
 * Caller supplied conversion rebuilding a single item from its byte form.
 *
 * @remarks
 * Data structure items are generic, so a data structure cannot decode them itself. Byte data structures take
 * a decoder as the `decode` half of the `ItemCodec` required at construction.
 *
 * @category Base
 */
export type ItemDecoder<ItemT> = (bytes: Uint8Array) => ItemT;
