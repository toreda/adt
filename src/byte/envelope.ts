import {type ItemDecoder} from '../item/decoder';
import {type ItemEncoder} from '../item/encoder';

/**
 * Byte representation of a whole collection. A directory header records where
 * each item's bytes live, followed by the item bytes themselves. The envelope
 * is shared by every byte data structure: only the item bytes inside it differ between data structures,
 * and producing or reading those requires the caller's `ItemCodec`.
 *
 * Layout, all integers little-endian:
 * ```
 * 0      u8[4]  magic "TADT"
 * 4      u8     format version
 * 5      u32    item count (n)
 * 9      n x {u32 offset, u32 length}   directory, offsets relative to payload start
 * 9 + 8n        payload: item bytes
 * ```
 *
 * Graphs store edges as well as items, so their bytes are a
 * `ByteGraphEnvelope`, which embeds one of these unchanged.
 *
 * Full specification: `_specs/byte-envelope.md`.
 *
 * @category Base
 */
export class ByteEnvelope {
	/** ASCII "TADT". */
	public static readonly Magic: readonly number[] = [0x54, 0x41, 0x44, 0x54];
	public static readonly Version = 1;
	/** Bytes before the directory: magic, version, item count. */
	public static readonly HeaderSize = 9;
	/** Bytes per directory entry: offset and length. */
	public static readonly EntrySize = 8;

	private _items: Uint8Array[];

	/**
	 * @param items		Byte form of each item, in collection order. The array is
	 * 					copied; the item arrays themselves are kept as given.
	 * 					Non-array input produces an empty envelope.
	 */
	constructor(items?: Uint8Array[] | null) {
		this._items = Array.isArray(items) ? items.slice() : [];
	}

	/**
	 * Build an envelope from items using the caller's encoder, in array order.
	 * The encoded array is built once and kept, not copied again.
	 */
	public static encode<ItemT>(items: ItemT[], encodeItem: ItemEncoder<ItemT>): ByteEnvelope {
		const encoded: Uint8Array[] = [];

		for (let i = 0; i < items.length; i++) {
			encoded.push(encodeItem(items[i]));
		}

		return ByteEnvelope.adopt(encoded);
	}

	/**
	 * Envelope that takes ownership of items without copying the array. Only
	 * for arrays built internally that nothing else references.
	 */
	private static adopt(items: Uint8Array[]): ByteEnvelope {
		const envelope = new ByteEnvelope();
		envelope._items = items;

		return envelope;
	}

	/**
	 * Parse and validate envelope bytes.
	 * @returns		Envelope, or null when bytes are not a well formed envelope:
	 * 				wrong magic or version, truncated header or directory, or a
	 * 				directory entry pointing outside the payload.
	 */
	public static fromBytes(bytes: Uint8Array): ByteEnvelope | null {
		if (!(bytes instanceof Uint8Array) || bytes.length < ByteEnvelope.HeaderSize) {
			return null;
		}

		for (let i = 0; i < ByteEnvelope.Magic.length; i++) {
			if (bytes[i] !== ByteEnvelope.Magic[i]) {
				return null;
			}
		}

		if (bytes[4] !== ByteEnvelope.Version) {
			return null;
		}

		const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
		const count = view.getUint32(5, true);
		const payloadStart = ByteEnvelope.HeaderSize + count * ByteEnvelope.EntrySize;

		if (payloadStart > bytes.length) {
			return null;
		}

		const items: Uint8Array[] = [];

		for (let i = 0; i < count; i++) {
			const entry = ByteEnvelope.HeaderSize + i * ByteEnvelope.EntrySize;
			const start = payloadStart + view.getUint32(entry, true);
			const end = start + view.getUint32(entry + 4, true);

			if (end > bytes.length) {
				return null;
			}

			// Copied, never a view: the envelope must not change when the
			// source does, and decoders commonly read item.buffer from offset 0.
			items.push(bytes.slice(start, end));
		}

		return ByteEnvelope.adopt(items);
	}

	/**
	 * Byte form of each item, in collection order.
	 */
	public items(): Uint8Array[] {
		return this._items.slice();
	}

	public size(): number {
		return this._items.length;
	}

	/**
	 * Rebuild items using the caller's decoder.
	 */
	public decode<ItemT>(decodeItem: ItemDecoder<ItemT>): ItemT[] {
		const items: ItemT[] = [];

		for (let i = 0; i < this._items.length; i++) {
			items.push(decodeItem(this._items[i]));
		}

		return items;
	}

	/**
	 * Serialize the envelope to bytes in the documented layout.
	 */
	public toBytes(): Uint8Array {
		const count = this._items.length;
		const payloadStart = ByteEnvelope.HeaderSize + count * ByteEnvelope.EntrySize;
		let payloadSize = 0;

		for (let i = 0; i < count; i++) {
			payloadSize += this._items[i].length;
		}

		const bytes = new Uint8Array(payloadStart + payloadSize);
		const view = new DataView(bytes.buffer);

		bytes.set(ByteEnvelope.Magic, 0);
		bytes[4] = ByteEnvelope.Version;
		view.setUint32(5, count, true);

		let offset = 0;
		for (let i = 0; i < count; i++) {
			const item = this._items[i];
			const entry = ByteEnvelope.HeaderSize + i * ByteEnvelope.EntrySize;

			view.setUint32(entry, offset, true);
			view.setUint32(entry + 4, item.length, true);
			bytes.set(item, payloadStart + offset);

			offset += item.length;
		}

		return bytes;
	}
}
