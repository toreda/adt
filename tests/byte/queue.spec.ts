import {ByteEnvelope} from '../../src/byte/envelope';
import {ByteQueue} from '../../src/byte/queue';
import {type ItemCodec} from '../../src/item/codec';
import {Queue} from '../../src/queue';

/** Codec for small non-negative integers: one byte each. */
const codec: ItemCodec<number> = {
	encode: (item) => new Uint8Array([item]),
	decode: (bytes) => bytes[0]
};

/** Codec for ASCII strings of any length, including empty ones. */
const textCodec: ItemCodec<string> = {
	encode: (item) => Uint8Array.from(item, (c) => c.charCodeAt(0)),
	decode: (bytes) => String.fromCharCode(...bytes)
};

describe('ByteQueue', () => {
	describe('constructor', () => {
		it('is a Queue', () => {
			const result = new ByteQueue(codec);

			expect(result).toBeInstanceOf(ByteQueue);
			expect(result).toBeInstanceOf(Queue);
			expect(result.size()).toBe(0);
			expect(result.codec).toBe(codec);
		});

		it('with items, front to rear', () => {
			const result = new ByteQueue(codec, [7, 8, 9]);

			expect(result.values()).toEqual([7, 8, 9]);
			expect(result.front()).toBe(7);
		});

		it('does not keep a reference to the provided array', () => {
			const items = [1, 2];
			const result = new ByteQueue(codec, items);
			items.push(3);

			expect(result.values()).toEqual([1, 2]);
		});

		it('from envelope bytes', () => {
			const bytes = new ByteQueue(codec, [7, 8, 9]).toBytes();
			const result = new ByteQueue(codec, bytes);

			expect(result.values()).toEqual([7, 8, 9]);
			expect(result.pop()).toBe(7);
		});

		it('from empty envelope bytes', () => {
			const bytes = new ByteQueue(codec).toBytes();

			expect(bytes.length).toBe(ByteEnvelope.HeaderSize);
			expect(new ByteQueue(codec, bytes).size()).toBe(0);
			expect(new ByteQueue(codec, bytes, null).size()).toBe(0);
		});

		it('passes options to Queue, queuing options.elements before data', () => {
			expect(new ByteQueue(codec, [3, 4], {elements: [1, 2]}).values()).toEqual([1, 2, 3, 4]);
			expect(new ByteQueue(codec, null, {elements: [1, 2]}).values()).toEqual([1, 2]);
		});

		it('ignores invalid data instead of throwing', () => {
			expect(new ByteQueue(codec, null).size()).toBe(0);
			expect(new ByteQueue(codec, undefined).size()).toBe(0);
			expect(new ByteQueue(codec, 'adsf' as any).size()).toBe(0);
			expect(new ByteQueue(codec, {elements: [4]} as any).size()).toBe(0);
		});

		it('throws without a valid codec', () => {
			expect(() => new (ByteQueue as any)()).toThrow();
			expect(() => new (ByteQueue as any)(null, [1])).toThrow();
			expect(() => new (ByteQueue as any)({encode: codec.encode}, [1])).toThrow();
			expect(() => new (ByteQueue as any)({decode: codec.decode}, [1])).toThrow();
			expect(() => new ByteQueue(codec, [1])).not.toThrow();
		});

		it('throws on bytes that are not a valid envelope', () => {
			expect(() => new ByteQueue(codec, new Uint8Array([1, 2, 3]))).toThrow();
			expect(() => new ByteQueue(codec, new Uint8Array(0))).toThrow();
		});

		it('propagates a codec that throws', () => {
			const bytes = new ByteQueue(codec, [1]).toBytes();
			const failing: ItemCodec<number> = {
				encode: codec.encode,
				decode: () => {
					throw new Error('decode failed');
				}
			};

			expect(() => new ByteQueue(failing, bytes)).toThrow('decode failed');
		});
	});

	describe('toByteEnvelope / toBytes', () => {
		it('encodes each item front to rear, including a wrapped queue', () => {
			const source = new ByteQueue(codec);
			for (let i = 0; i < 16; i++) {
				source.push(i);
			}
			for (let i = 0; i < 14; i++) {
				source.pop();
			}
			source.push(16);
			source.push(17);

			const envelope = source.toByteEnvelope();

			expect(envelope).toBeInstanceOf(ByteEnvelope);
			expect(envelope.decode(codec.decode)).toEqual([14, 15, 16, 17]);
			expect(source.toBytes()).toEqual(envelope.toBytes());
		});

		it('empty queue produces an empty envelope', () => {
			expect(new ByteQueue(codec).toByteEnvelope().size()).toBe(0);
		});

		it('round trips byte for byte', () => {
			const source = new ByteQueue(codec, [10, 20, 30]);
			const bytes = source.toBytes();
			const result = new ByteQueue(codec, bytes);

			expect(result.values()).toEqual([10, 20, 30]);
			expect(result.stringify()).toBe(source.stringify());
			expect(result.toBytes()).toEqual(bytes);
		});

		it('round trips variable length and empty items', () => {
			const source = new ByteQueue(textCodec, ['alpha', '', 'gamma delta', 'e']);
			const bytes = source.toBytes();
			const result = new ByteQueue(textCodec, bytes);

			expect(result.values()).toEqual(['alpha', '', 'gamma delta', 'e']);
			expect(result.toBytes()).toEqual(bytes);
		});

		it('round trips more items than the starting capacity', () => {
			const items = Array.from({length: 200}, (_, i) => i);
			const bytes = new ByteQueue(codec, items).toBytes();
			const result = new ByteQueue(codec, bytes);

			expect(result.values()).toEqual(items);
			expect(result.toBytes()).toEqual(bytes);
		});
	});

	describe('inherited behavior', () => {
		it('filter returns a ByteQueue with the same codec', () => {
			const source = new ByteQueue(codec, [1, 2, 3]);
			const filtered = source.filter((item) => item > 1);

			expect(filtered).toBeInstanceOf(ByteQueue);
			expect(filtered.codec).toBe(codec);
			expect(filtered.values()).toEqual([2, 3]);
			expect(new ByteQueue(codec, filtered.toBytes()).values()).toEqual([2, 3]);
			expect(source.size()).toBe(3);
		});

		it('filter honors thisArg', () => {
			const source = new ByteQueue(codec, [1, 2, 3]);
			const ctx = {min: 2};
			const filtered = source.filter(function (this: typeof ctx, item) {
				return item >= this.min;
			}, ctx);

			expect(filtered.values()).toEqual([2, 3]);
		});

		it('reset keeps the codec', () => {
			const source = new ByteQueue(codec, [1, 2, 3]);
			source.reset();

			expect(source.size()).toBe(0);
			expect(source.codec).toBe(codec);
			expect(source.toByteEnvelope().size()).toBe(0);
		});

		it('pop returns the removed item', () => {
			const source = new ByteQueue(codec, [1, 2]);

			expect(source.pop()).toBe(1);
			expect(source.toByteEnvelope().decode(codec.decode)).toEqual([2]);
		});
	});
});
