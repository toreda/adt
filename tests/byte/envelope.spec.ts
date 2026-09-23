import {ByteEnvelope} from '../../src/byte/envelope';

const encodeItem = (item: number): Uint8Array => new Uint8Array([item & 0xff, (item >> 8) & 0xff]);
const decodeItem = (bytes: Uint8Array): number => bytes[0] | (bytes[1] << 8);

/** Little-endian u32 read, for asserting header fields directly. */
const u32 = (bytes: Uint8Array, offset: number): number =>
	new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, true);

describe('ByteEnvelope', () => {
	describe('constructor', () => {
		it('starts empty by default', () => {
			expect(new ByteEnvelope().size()).toBe(0);
			expect(new ByteEnvelope(null).size()).toBe(0);
			expect(new ByteEnvelope('nope' as any).size()).toBe(0);
		});

		it('copies the provided item array', () => {
			const items = [new Uint8Array([1])];
			const envelope = new ByteEnvelope(items);
			items.push(new Uint8Array([2]));

			expect(envelope.size()).toBe(1);
			expect(envelope.items()).toEqual([new Uint8Array([1])]);
		});

		it('items() returns a copy', () => {
			const envelope = new ByteEnvelope([new Uint8Array([1])]);
			envelope.items().push(new Uint8Array([2]));

			expect(envelope.size()).toBe(1);
		});
	});

	describe('encode / decode', () => {
		it('encodes each item with the caller helper in order', () => {
			const envelope = ByteEnvelope.encode([1, 258], encodeItem);

			expect(envelope.items()).toEqual([new Uint8Array([1, 0]), new Uint8Array([2, 1])]);
		});

		it('decodes each item with the caller helper in order', () => {
			const envelope = new ByteEnvelope([new Uint8Array([1, 0]), new Uint8Array([2, 1])]);

			expect(envelope.decode(decodeItem)).toEqual([1, 258]);
		});
	});

	describe('toBytes', () => {
		it('writes magic, version, count and directory', () => {
			const bytes = new ByteEnvelope([
				new Uint8Array([9, 9, 9]),
				new Uint8Array([]),
				new Uint8Array([7])
			]).toBytes();

			expect(Array.from(bytes.slice(0, 4))).toEqual(ByteEnvelope.Magic);
			expect(bytes[4]).toBe(ByteEnvelope.Version);
			expect(u32(bytes, 5)).toBe(3);

			// Directory: offset/length pairs relative to payload start.
			expect(u32(bytes, 9)).toBe(0);
			expect(u32(bytes, 13)).toBe(3);
			expect(u32(bytes, 17)).toBe(3);
			expect(u32(bytes, 21)).toBe(0);
			expect(u32(bytes, 25)).toBe(3);
			expect(u32(bytes, 29)).toBe(1);

			const payloadStart = ByteEnvelope.HeaderSize + 3 * ByteEnvelope.EntrySize;
			expect(Array.from(bytes.slice(payloadStart))).toEqual([9, 9, 9, 7]);
			expect(bytes.length).toBe(payloadStart + 4);
		});

		it('empty envelope is header only', () => {
			const bytes = new ByteEnvelope().toBytes();

			expect(bytes.length).toBe(ByteEnvelope.HeaderSize);
			expect(u32(bytes, 5)).toBe(0);
		});
	});

	describe('fromBytes', () => {
		it('round trips', () => {
			const source = ByteEnvelope.encode([0, 1, 65535, 4000], encodeItem);
			const result = ByteEnvelope.fromBytes(source.toBytes());

			expect(result).toBeInstanceOf(ByteEnvelope);
			expect(result?.items()).toEqual(source.items());
			expect(result?.decode(decodeItem)).toEqual([0, 1, 65535, 4000]);
		});

		it('round trips an empty envelope', () => {
			expect(ByteEnvelope.fromBytes(new ByteEnvelope().toBytes())?.size()).toBe(0);
		});

		it('reads from a view into a larger buffer', () => {
			const inner = ByteEnvelope.encode([5, 6], encodeItem).toBytes();
			const outer = new Uint8Array(inner.length + 8);
			outer.set(inner, 4);
			const view = outer.subarray(4, 4 + inner.length);

			expect(ByteEnvelope.fromBytes(view)?.decode(decodeItem)).toEqual([5, 6]);
		});

		it('returned items do not alias the source bytes', () => {
			const bytes = ByteEnvelope.encode([5], encodeItem).toBytes();
			const result = ByteEnvelope.fromBytes(bytes) as ByteEnvelope;
			bytes.fill(0);

			expect(result.decode(decodeItem)).toEqual([5]);
		});

		it('rejects non byte input', () => {
			expect(ByteEnvelope.fromBytes(null as any)).toBeNull();
			expect(ByteEnvelope.fromBytes('TADT' as any)).toBeNull();
			expect(ByteEnvelope.fromBytes([0x54, 0x41, 0x44, 0x54, 1, 0, 0, 0, 0] as any)).toBeNull();
		});

		it('rejects a truncated header', () => {
			const bytes = new ByteEnvelope().toBytes();

			expect(ByteEnvelope.fromBytes(bytes.slice(0, ByteEnvelope.HeaderSize - 1))).toBeNull();
			expect(ByteEnvelope.fromBytes(new Uint8Array(0))).toBeNull();
		});

		it('rejects wrong magic', () => {
			const bytes = new ByteEnvelope().toBytes();
			bytes[0] = 0x00;

			expect(ByteEnvelope.fromBytes(bytes)).toBeNull();
		});

		it('rejects wrong version', () => {
			const bytes = new ByteEnvelope().toBytes();
			bytes[4] = ByteEnvelope.Version + 1;

			expect(ByteEnvelope.fromBytes(bytes)).toBeNull();
		});

		it('rejects a directory that runs past the end', () => {
			const bytes = ByteEnvelope.encode([1, 2], encodeItem).toBytes();
			new DataView(bytes.buffer).setUint32(5, 3, true);

			expect(ByteEnvelope.fromBytes(bytes)).toBeNull();
		});

		it('rejects an item whose bytes run past the end', () => {
			const bytes = ByteEnvelope.encode([1, 2], encodeItem).toBytes();
			// Length of the second item.
			new DataView(bytes.buffer).setUint32(
				ByteEnvelope.HeaderSize + ByteEnvelope.EntrySize + 4,
				3,
				true
			);

			expect(ByteEnvelope.fromBytes(bytes)).toBeNull();
		});

		it('rejects an item whose offset is past the end', () => {
			const bytes = ByteEnvelope.encode([1], encodeItem).toBytes();
			new DataView(bytes.buffer).setUint32(ByteEnvelope.HeaderSize, 100, true);

			expect(ByteEnvelope.fromBytes(bytes)).toBeNull();
		});

		it('rejects truncated payload', () => {
			const bytes = ByteEnvelope.encode([1, 2], encodeItem).toBytes();

			expect(ByteEnvelope.fromBytes(bytes.slice(0, bytes.length - 1))).toBeNull();
		});
	});
});
