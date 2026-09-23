/**
 * Caller supplied conversion rebuilding a single item from its byte form.
 *
 * @remarks
 * ADT items are generic, so an ADT cannot decode them itself. Byte ADTs take
 * a decoder as the `decode` half of the `ItemCodec` required at construction.
 *
 * @category Base
 */
export type ItemDecoder<ItemT> = (bytes: Uint8Array) => ItemT;
