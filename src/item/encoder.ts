/**
 * Caller supplied conversion producing the byte form of a single item.
 *
 * @remarks
 * ADT items are generic, so an ADT cannot encode them itself. Byte ADTs take
 * an encoder as the `encode` half of the `ItemCodec` required at construction.
 *
 * @category Base
 */
export type ItemEncoder<ItemT> = (item: ItemT) => Uint8Array;
