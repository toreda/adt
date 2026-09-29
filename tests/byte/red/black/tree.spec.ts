import {ByteEnvelope} from '../../../../src/byte/envelope';
import {ByteRedBlackTree} from '../../../../src/byte/red/black/tree';
import {type ItemCodec} from '../../../../src/item/codec';
import {RedBlackTree} from '../../../../src/red/black/tree';

/** Codec for small non-negative integers: one byte each. */
const codec: ItemCodec<number> = {
	encode: (item) => new Uint8Array([item]),
	decode: (bytes) => bytes[0]
};

const byNumber = (a: number, b: number): number => a - b;

/** Envelope bytes holding items in the given order, bypassing any tree. */
const rawBytes = (items: number[]): Uint8Array => ByteEnvelope.encode(items, codec.encode).toBytes();

/** Checks the red-black rules and parent links on every node. */
const expectValid = (tree: RedBlackTree<number>): void => {
	const values = tree.values();
	let blacks: number | null = null;
	const stack: {node: any; count: number}[] = [{node: tree.root(), count: 0}];

	expect(tree.root()?.color() ?? 'black').toBe('black');
	expect([...values].sort(byNumber)).toEqual(values);
	expect(values.length).toBe(tree.size());

	while (stack.length) {
		const {node, count} = stack.pop()!;
		if (!node) {
			blacks = blacks ?? count;
			expect(count).toBe(blacks);
			continue;
		}
		const below = count + (node.color() === 'black' ? 1 : 0);
		for (const child of [node.left(), node.right()]) {
			if (child) {
				expect(child.parent()).toBe(node);
				if (node.color() === 'red') {
					expect(child.color()).toBe('black');
				}
			}
			stack.push({node: child, count: below});
		}
	}
};

describe('ByteRedBlackTree', () => {
	describe('constructor', () => {
		it('is a RedBlackTree', () => {
			const result = new ByteRedBlackTree(codec, byNumber);

			expect(result).toBeInstanceOf(ByteRedBlackTree);
			expect(result).toBeInstanceOf(RedBlackTree);
			expect(result.size()).toBe(0);
			expect(result.codec).toBe(codec);
			expect(result.comparator).toBe(byNumber);
		});

		it('with items', () => {
			const result = new ByteRedBlackTree(codec, byNumber, [9, 7, 8]);

			expect(result.values()).toEqual([7, 8, 9]);
			expectValid(result);
		});

		it('from envelope bytes', () => {
			const bytes = new ByteRedBlackTree(codec, byNumber, [9, 7, 8]).toBytes();
			const result = new ByteRedBlackTree(codec, byNumber, bytes);

			expect(result.values()).toEqual([7, 8, 9]);
			expectValid(result);
		});

		it('from sorted bytes builds a balanced tree', () => {
			const items: number[] = [];
			for (let i = 0; i < 100; i++) {
				items.push(i);
			}
			const result = new ByteRedBlackTree(codec, byNumber, rawBytes(items));

			expect(result.values()).toEqual(items);
			expect(result.height()).toBe(Math.floor(Math.log2(items.length)));
			expectValid(result);
		});

		it('from unsorted bytes inserts each item', () => {
			const result = new ByteRedBlackTree(codec, byNumber, rawBytes([5, 1, 4, 2, 3, 3]));

			expect(result.values()).toEqual([1, 2, 3, 3, 4, 5]);
			expectValid(result);
		});

		it('from bytes skips duplicates when duplicates are not allowed', () => {
			const sorted = new ByteRedBlackTree(codec, byNumber, rawBytes([1, 2, 2, 3]), {
				allowDuplicates: false
			});
			const unsorted = new ByteRedBlackTree(codec, byNumber, rawBytes([3, 2, 1, 2]), {
				allowDuplicates: false
			});

			expect(sorted.values()).toEqual([1, 2, 3]);
			expect(unsorted.values()).toEqual([1, 2, 3]);
			expectValid(sorted);
			expectValid(unsorted);
		});

		it('from empty envelope bytes', () => {
			const bytes = new ByteRedBlackTree(codec, byNumber).toBytes();

			expect(new ByteRedBlackTree(codec, byNumber, bytes).size()).toBe(0);
			expect(new ByteRedBlackTree(codec, byNumber, bytes, null).size()).toBe(0);
		});

		it('ignores invalid data instead of throwing', () => {
			expect(new ByteRedBlackTree(codec, byNumber, null).size()).toBe(0);
			expect(new ByteRedBlackTree(codec, byNumber, 'adsf' as any).size()).toBe(0);
			expect(new ByteRedBlackTree(codec, byNumber, {elements: [4]} as any).size()).toBe(0);
		});

		it('throws without a valid codec', () => {
			expect(() => new (ByteRedBlackTree as any)()).toThrow();
			expect(() => new (ByteRedBlackTree as any)(null, byNumber, [1])).toThrow();
			expect(() => new (ByteRedBlackTree as any)({encode: codec.encode}, byNumber, [1])).toThrow();
			expect(() => new (ByteRedBlackTree as any)({decode: codec.decode}, byNumber, [1])).toThrow();
			expect(() => new (ByteRedBlackTree as any)({encode: 'nope', decode: 'nope'}, byNumber)).toThrow();
			expect(() => new ByteRedBlackTree(codec, byNumber, [1])).not.toThrow();
		});

		it('throws without a comparator', () => {
			expect(() => new ByteRedBlackTree(codec, null as any)).toThrow();
			expect(() => new ByteRedBlackTree(codec, {} as any, [1])).toThrow();
		});

		it('throws on bytes that are not a valid envelope', () => {
			expect(() => new ByteRedBlackTree(codec, byNumber, new Uint8Array([1, 2, 3]))).toThrow();
		});
	});

	describe('toByteEnvelope', () => {
		it('encodes each item in sorted order', () => {
			const encode = jest.fn(codec.encode);
			const source = new ByteRedBlackTree<number>({encode, decode: codec.decode}, byNumber, [3, 1, 2]);

			const envelope = source.toByteEnvelope();

			expect(envelope).toBeInstanceOf(ByteEnvelope);
			expect(encode).toHaveBeenCalledTimes(3);
			expect(envelope.items()).toEqual([new Uint8Array([1]), new Uint8Array([2]), new Uint8Array([3])]);
		});

		it('encodes exactly the items stringify includes', () => {
			const source = new ByteRedBlackTree(codec, byNumber, [4, 2, 2, 9]);

			expect(source.toByteEnvelope().decode(codec.decode)).toEqual(
				JSON.parse(source.stringify() as string).elements
			);
		});

		it('empty tree produces an empty envelope', () => {
			expect(new ByteRedBlackTree(codec, byNumber).toByteEnvelope().size()).toBe(0);
		});
	});

	describe('toBytes', () => {
		it('returns the serialized envelope', () => {
			const source = new ByteRedBlackTree(codec, byNumber, [3, 1, 2]);

			expect(source.toBytes()).toEqual(source.toByteEnvelope().toBytes());
			expect(ByteEnvelope.fromBytes(source.toBytes())?.decode(codec.decode)).toEqual([1, 2, 3]);
		});

		it('round trips byte for byte', () => {
			for (let count = 0; count < 40; count++) {
				const items: number[] = [];
				for (let i = 0; i < count; i++) {
					items.push((i * 17) % 23);
				}
				const source = new ByteRedBlackTree(codec, byNumber, items);
				const bytes = source.toBytes();
				const result = new ByteRedBlackTree(codec, byNumber, bytes);

				expect(result.values()).toEqual(source.values());
				expect(result.stringify()).toBe(source.stringify());
				expect(result.toBytes()).toEqual(bytes);
				expectValid(result);
			}
		});

		it('round trip keeps equal items in order', () => {
			type Keyed = {k: number; id: number};
			const keyedCodec: ItemCodec<Keyed> = {
				encode: (item) => new Uint8Array([item.k, item.id]),
				decode: (bytes) => ({k: bytes[0], id: bytes[1]})
			};
			const byKey = (a: Keyed, b: Keyed): number => a.k - b.k;
			const source = new ByteRedBlackTree(keyedCodec, byKey, [
				{k: 2, id: 1},
				{k: 1, id: 2},
				{k: 2, id: 3},
				{k: 2, id: 4}
			]);
			const result = new ByteRedBlackTree(keyedCodec, byKey, source.toBytes());

			expect(result.values()).toEqual(source.values());
			expect(result.toBytes()).toEqual(source.toBytes());
		});

		it('decoded tree stays valid under further edits', () => {
			const result = new ByteRedBlackTree(codec, byNumber, rawBytes([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
			result.insert(4);
			result.remove(0);
			result.remove(9);

			expect(result.values()).toEqual([1, 2, 3, 4, 4, 5, 6, 7, 8]);
			expectValid(result);
		});
	});

	describe('inherited behavior', () => {
		it('filter returns a ByteRedBlackTree with the same codec and comparator', () => {
			const source = new ByteRedBlackTree(codec, byNumber, [1, 2, 3]);
			const filtered = source.filter((e) => (e.value() as number) > 1);

			expect(filtered).toBeInstanceOf(ByteRedBlackTree);
			expect(filtered.codec).toBe(codec);
			expect(filtered.comparator).toBe(byNumber);
			expect(filtered.values()).toEqual([2, 3]);
			expect(filtered.toByteEnvelope().size()).toBe(2);
			expectValid(filtered);
		});

		it('filter carries options as well as the codec', () => {
			const plain = new ByteRedBlackTree(codec, byNumber, [1, 2], {
				disableElementPooling: true,
				allowDuplicates: false
			});
			const pooled = new ByteRedBlackTree(codec, byNumber, [1, 2]);

			expect((plain.filter(() => true) as any).elements.objectPool).toBeNull();
			expect(plain.filter(() => true).allowDuplicates).toBe(false);
			expect((pooled.filter(() => true) as any).elements.objectPool).not.toBeNull();
		});

		it('filter honors thisArg', () => {
			const source = new ByteRedBlackTree(codec, byNumber, [1, 2, 3]);
			const ctx = {min: 2};
			const filtered = source.filter(function (this: typeof ctx, e) {
				return (e.value() as number) >= this.min;
			}, ctx);

			expect(filtered.values()).toEqual([2, 3]);
		});

		it('round trips with pooling disabled', () => {
			const source = new ByteRedBlackTree(codec, byNumber, [10, 20, 30], {disableElementPooling: true});
			const result = new ByteRedBlackTree(codec, byNumber, source.toBytes(), {
				disableElementPooling: true
			});

			expect(result.values()).toEqual([10, 20, 30]);
			expect((result as any).elements.objectPool).toBeNull();
		});

		it('reset keeps the codec', () => {
			const source = new ByteRedBlackTree(codec, byNumber, [1, 2, 3]);
			source.reset();

			expect(source.size()).toBe(0);
			expect(source.codec).toBe(codec);
			expect(source.toByteEnvelope().size()).toBe(0);
		});
	});
});
