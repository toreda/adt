import {ByteCircularQueue} from '../../../src/byte/circular/queue';
import {ByteEnvelope} from '../../../src/byte/envelope';
import {CircularQueue} from '../../../src/circular/queue';
import {type ItemCodec} from '../../../src/item/codec';

/** Codec for small non-negative integers: one byte each. */
const codec: ItemCodec<number> = {
	encode: (item) => new Uint8Array([item]),
	decode: (bytes) => bytes[0]
};

describe('ByteCircularQueue', () => {
	describe('constructor', () => {
		it('is a CircularQueue', () => {
			const result = new ByteCircularQueue(codec);

			expect(result).toBeInstanceOf(ByteCircularQueue);
			expect(result).toBeInstanceOf(CircularQueue);
			expect(result.size()).toBe(0);
			expect(result.codec).toBe(codec);
		});

		it('with items', () => {
			expect(new ByteCircularQueue(codec, [7, 8, 9]).values()).toEqual([7, 8, 9]);
		});

		it('from envelope bytes', () => {
			const bytes = new ByteCircularQueue(codec, [7, 8, 9]).toBytes();

			expect(new ByteCircularQueue(codec, bytes).values()).toEqual([7, 8, 9]);
		});

		it('from empty envelope bytes', () => {
			const bytes = new ByteCircularQueue(codec).toBytes();

			expect(new ByteCircularQueue(codec, bytes).size()).toBe(0);
			expect(new ByteCircularQueue(codec, bytes, null).size()).toBe(0);
		});

		it('handles decoded items beyond maxSize as push does', () => {
			const bytes = new ByteCircularQueue(codec, [1, 2, 3, 4]).toBytes();

			expect(new ByteCircularQueue(codec, bytes, {maxSize: 3}).values()).toEqual([1, 2, 3]);
			expect(new ByteCircularQueue(codec, bytes, {maxSize: 3, overwrite: true}).values()).toEqual([
				2, 3, 4
			]);
		});

		it('ignores invalid data instead of throwing', () => {
			expect(new ByteCircularQueue(codec, null).size()).toBe(0);
			expect(new ByteCircularQueue(codec, 'adsf' as any).size()).toBe(0);
			expect(new ByteCircularQueue(codec, {elements: [4]} as any).size()).toBe(0);
		});

		it('throws without a valid codec', () => {
			expect(() => new (ByteCircularQueue as any)()).toThrow();
			expect(() => new (ByteCircularQueue as any)(null, [1])).toThrow();
			expect(() => new (ByteCircularQueue as any)({encode: codec.encode}, [1])).toThrow();
			expect(() => new (ByteCircularQueue as any)({decode: codec.decode}, [1])).toThrow();
			expect(() => new ByteCircularQueue(codec, [1])).not.toThrow();
		});

		it('throws on bytes that are not a valid envelope', () => {
			expect(() => new ByteCircularQueue(codec, new Uint8Array([1, 2, 3]))).toThrow();
		});
	});

	describe('toByteEnvelope / toBytes', () => {
		it('encodes each item front to rear, including a wrapped queue', () => {
			const source = new ByteCircularQueue(codec, [1, 2, 3, 4], {maxSize: 4});
			source.pop();
			source.pop();
			source.push(5);
			source.push(6);

			const envelope = source.toByteEnvelope();

			expect(envelope).toBeInstanceOf(ByteEnvelope);
			expect(envelope.decode(codec.decode)).toEqual([3, 4, 5, 6]);
			expect(source.toBytes()).toEqual(envelope.toBytes());
		});

		it('empty queue produces an empty envelope', () => {
			expect(new ByteCircularQueue(codec).toByteEnvelope().size()).toBe(0);
		});

		it('round trips', () => {
			const source = new ByteCircularQueue(codec, [10, 20, 30], {maxSize: 5});
			const bytes = source.toBytes();
			const result = new ByteCircularQueue(codec, bytes, {maxSize: 5});

			expect(result.values()).toEqual([10, 20, 30]);
			expect(result.stringify()).toBe(source.stringify());
			expect(result.toBytes()).toEqual(bytes);
		});
	});

	describe('inherited behavior', () => {
		it('filter returns a ByteCircularQueue with the same codec and options', () => {
			const source = new ByteCircularQueue(codec, [1, 2, 3], {maxSize: 6, overwrite: true});
			const filtered = source.filter((item) => item > 1);

			expect(filtered).toBeInstanceOf(ByteCircularQueue);
			expect(filtered.codec).toBe(codec);
			expect(filtered.values()).toEqual([2, 3]);
			expect(filtered.maxSize).toBe(6);
			expect(filtered.overwrite).toBe(true);
		});

		it('filter honors thisArg', () => {
			const source = new ByteCircularQueue(codec, [1, 2, 3]);
			const ctx = {min: 2};
			const filtered = source.filter(function (this: typeof ctx, item) {
				return item >= this.min;
			}, ctx);

			expect(filtered.values()).toEqual([2, 3]);
		});

		it('reset keeps the codec', () => {
			const source = new ByteCircularQueue(codec, [1, 2, 3]);
			source.reset();

			expect(source.size()).toBe(0);
			expect(source.codec).toBe(codec);
			expect(source.toByteEnvelope().size()).toBe(0);
		});
	});
});
