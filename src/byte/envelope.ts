import {type ItemDecoder} from '../item/decoder';
import {type ItemEncoder} from '../item/encoder';

/**
 * Byte representation of a whole collection. A directory header records where
 * each item's bytes live, followed by the item bytes themselves. The envelope
 * is shared by every byte ADT: only the item bytes inside it are ADT specific,
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

	private readonly _items: Uint8Array[];

	/**
	 * @param items		Byte form of each item, in collection order. Non-array
	 * 					input produces an empty envelope.
	 */
	constructor(items?: Uint8Array[] | null) {
		this._items = Array.isArray(items) ? items.slice() : [];
	}

	/**
	 * Build an envelope from items using the caller's encoder.
	 */
	public static encode<ItemT>(items: ItemT[], encodeItem: ItemEncoder<ItemT>): ByteEnvelope {
		return new ByteEnvelope(items.map((item) => encodeItem(item)));
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

		if (!ByteEnvelope.Magic.every((byte, i) => bytes[i] === byte)) {
			return null;
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

			items.push(bytes.slice(start, end));
		}

		return new ByteEnvelope(items);
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
		return this._items.map((bytes) => decodeItem(bytes));
	}

	/**
	 * Serialize the envelope to bytes in the documented layout.
	 */
	public toBytes(): Uint8Array {
		const count = this._items.length;
		const payloadStart = ByteEnvelope.HeaderSize + count * ByteEnvelope.EntrySize;
		const payloadSize = this._items.reduce((total, item) => total + item.length, 0);

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
