import {BinarySearchTree} from '../../../../src/binary/search/tree';
import {ByteBinarySearchTree} from '../../../../src/byte/binary/search/tree';
import {ByteEnvelope} from '../../../../src/byte/envelope';
import {type ItemCodec} from '../../../../src/item/codec';

/** Codec for small non-negative integers: one byte each. */
const codec: ItemCodec<number> = {
	encode: (item) => new Uint8Array([item]),
	decode: (bytes) => bytes[0]
};

const byNumber = (a: number, b: number): number => a - b;
const shape = [50, 30, 70, 20, 40, 60, 80];

describe('ByteBinarySearchTree', () => {
	describe('constructor', () => {
		it('is a BinarySearchTree', () => {
			const result = new ByteBinarySearchTree(codec, byNumber);

			expect(result).toBeInstanceOf(ByteBinarySearchTree);
			expect(result).toBeInstanceOf(BinarySearchTree);
			expect(result.size()).toBe(0);
			expect(result.codec).toBe(codec);
			expect(result.comparator).toBe(byNumber);
		});

		it('with items', () => {
			const result = new ByteBinarySearchTree(codec, byNumber, [3, 1, 2]);

			expect(result.values()).toEqual([1, 2, 3]);
			expect(result.preOrder()).toEqual([3, 1, 2]);
		});

		it('from envelope bytes', () => {
			const bytes = new ByteBinarySearchTree(codec, byNumber, shape).toBytes();
			const result = new ByteBinarySearchTree(codec, byNumber, bytes);

			expect(result.values()).toEqual([20, 30, 40, 50, 60, 70, 80]);
		});

		it('from empty envelope bytes', () => {
			const bytes = new ByteBinarySearchTree(codec, byNumber).toBytes();

			expect(bytes.length).toBe(ByteEnvelope.HeaderSize);
			expect(new ByteBinarySearchTree(codec, byNumber, bytes).size()).toBe(0);
			expect(new ByteBinarySearchTree(codec, byNumber, bytes, null).size()).toBe(0);
		});

		it('ignores invalid data instead of throwing', () => {
			expect(new ByteBinarySearchTree(codec, byNumber, null).size()).toBe(0);
			expect(new ByteBinarySearchTree(codec, byNumber, 'adsf' as any).size()).toBe(0);
			expect(new ByteBinarySearchTree(codec, byNumber, {elements: [4]} as any).size()).toBe(0);
		});

		it('throws without a valid codec', () => {
			const Ctor = ByteBinarySearchTree as any;

			expect(() => new Ctor(undefined, byNumber)).toThrow();
			expect(() => new Ctor(null, byNumber, [1])).toThrow();
			expect(() => new Ctor({encode: codec.encode}, byNumber, [1])).toThrow();
			expect(() => new Ctor({decode: codec.decode}, byNumber, [1])).toThrow();
			expect(() => new Ctor({encode: 'nope', decode: 'nope'}, byNumber, [1])).toThrow();
			expect(() => new ByteBinarySearchTree(codec, byNumber, [1])).not.toThrow();
		});

		it('throws without a comparator', () => {
			expect(() => new (ByteBinarySearchTree as any)(codec)).toThrow();
			expect(() => new (ByteBinarySearchTree as any)(codec, 'nope', [1])).toThrow();
		});

		it('throws on bytes that are not a valid envelope', () => {
			expect(() => new ByteBinarySearchTree(codec, byNumber, new Uint8Array([1, 2, 3]))).toThrow();
		});

		it('skips duplicates in bytes when duplicates are not allowed', () => {
			const bytes = new ByteEnvelope([
				new Uint8Array([2]),
				new Uint8Array([1]),
				new Uint8Array([2])
			]).toBytes();
			const result = new ByteBinarySearchTree(codec, byNumber, bytes, {allowDuplicates: false});

			expect(result.values()).toEqual([1, 2]);
		});
	});

	describe('toByteEnvelope', () => {
		it('encodes each item in pre-order', () => {
			const encode = jest.fn(codec.encode);
			const source = new ByteBinarySearchTree<number>({encode, decode: codec.decode}, byNumber, shape);

			const envelope = source.toByteEnvelope();

			expect(envelope).toBeInstanceOf(ByteEnvelope);
			expect(encode).toHaveBeenCalledTimes(7);
			expect(envelope.decode(codec.decode)).toEqual([50, 30, 20, 40, 70, 60, 80]);
		});

		it('passes null items to the codec, matching stringify', () => {
			const encode = jest.fn((item: number | null) => new Uint8Array(item === null ? [] : [item]));
			const source = new ByteBinarySearchTree<number | null>(
				{encode, decode: (bytes) => (bytes.length ? bytes[0] : null)},
				() => 0,
				[1, null, 2]
			);

			expect(source.toByteEnvelope().size()).toBe(3);
			expect(encode).toHaveBeenCalledWith(null);
		});

		it('empty tree produces an empty envelope', () => {
			expect(new ByteBinarySearchTree(codec, byNumber).toByteEnvelope().size()).toBe(0);
		});
	});

	describe('toBytes', () => {
		it('returns the serialized envelope', () => {
			const source = new ByteBinarySearchTree(codec, byNumber, shape);

			expect(source.toBytes()).toEqual(source.toByteEnvelope().toBytes());
		});

		it('round trips the same shape byte for byte', () => {
			const shapes = [shape, [1, 2, 3, 4, 5], [5, 4, 3, 2, 1], [3, 3, 1, 3, 2, 5, 3, 4], [9]];

			for (const items of shapes) {
				const source = new ByteBinarySearchTree(codec, byNumber, items);
				const bytes = source.toBytes();
				const result = new ByteBinarySearchTree(codec, byNumber, bytes);

				expect(result.levelOrder()).toEqual(source.levelOrder());
				expect(result.preOrder()).toEqual(source.preOrder());
				expect(result.height()).toBe(source.height());
				expect(result.stringify()).toBe(source.stringify());
				expect(result.toBytes()).toEqual(bytes);
			}
		});

		it('round trips equal items in insertion order', () => {
			type Entry = {k: number; id: number};
			const entryCodec: ItemCodec<Entry> = {
				encode: (item) => new Uint8Array([item.k, item.id]),
				decode: (bytes) => ({k: bytes[0], id: bytes[1]})
			};
			const byKey = (a: Entry, b: Entry): number => a.k - b.k;
			const items = [2, 1, 2, 3, 2, 1].map((k, id) => ({k, id}));
			const source = new ByteBinarySearchTree(entryCodec, byKey, items);
			const result = new ByteBinarySearchTree(entryCodec, byKey, source.toBytes());

			expect(result.values()).toEqual(source.values());
			expect(result.values().map((e) => e.id)).toEqual([1, 5, 0, 2, 4, 3]);
			expect(result.toBytes()).toEqual(source.toBytes());
		});

		it('round trips after updates and removals', () => {
			const source = new ByteBinarySearchTree(codec, byNumber, shape);
			source.update(source.find(30), 75);
			source.remove(50);
			const result = new ByteBinarySearchTree(codec, byNumber, source.toBytes());

			expect(result.levelOrder()).toEqual(source.levelOrder());
			expect(result.toBytes()).toEqual(source.toBytes());
		});
	});

	describe('inherited behavior', () => {
		it('filter returns a ByteBinarySearchTree with the same codec and comparator', () => {
			const source = new ByteBinarySearchTree(codec, byNumber, shape);
			const filtered = source.filter((e) => (e.value() as number) > 30);

			expect(filtered).toBeInstanceOf(ByteBinarySearchTree);
			expect(filtered.codec).toBe(codec);
			expect(filtered.comparator).toBe(byNumber);
			expect(filtered.values()).toEqual([40, 50, 60, 70, 80]);
			expect(filtered.toByteEnvelope().size()).toBe(5);
		});

		it('filter result round trips', () => {
			const filtered = new ByteBinarySearchTree(codec, byNumber, shape).filter(() => true);
			const result = new ByteBinarySearchTree(codec, byNumber, filtered.toBytes());

			expect(result.levelOrder()).toEqual(filtered.levelOrder());
		});

		it('filter carries options as well as the codec', () => {
			const plain = new ByteBinarySearchTree(codec, byNumber, [1, 2], {
				disableElementPooling: true,
				allowDuplicates: false
			});
			const pooled = new ByteBinarySearchTree(codec, byNumber, [1, 2]);

			expect((plain.filter(() => true) as any).elements.objectPool).toBeNull();
			expect(plain.filter(() => true).allowDuplicates).toBe(false);
			expect((pooled.filter(() => true) as any).elements.objectPool).not.toBeNull();
		});

		it('filter honors thisArg', () => {
			const source = new ByteBinarySearchTree(codec, byNumber, [1, 2, 3]);
			const ctx = {min: 2};
			const filtered = source.filter(function (this: typeof ctx, e) {
				return (e.value() as number) >= this.min;
			}, ctx);

			expect(filtered.values()).toEqual([2, 3]);
		});

		it('reset keeps the codec', () => {
			const source = new ByteBinarySearchTree(codec, byNumber, [1, 2, 3]);
			source.reset();

			expect(source.size()).toBe(0);
			expect(source.codec).toBe(codec);
			expect(source.toByteEnvelope().size()).toBe(0);
		});
	});
});
