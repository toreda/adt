/**
 * Caller supplied conversion producing the byte form of a single item.
 *
 * @remarks
 * Data structure items are generic, so a data structure cannot encode them itself. Byte data structures take
 * an encoder as the `encode` half of the `ItemCodec` required at construction.
 *
 * @category Base
 */
export type ItemEncoder<ItemT> = (item: ItemT) => Uint8Array;
