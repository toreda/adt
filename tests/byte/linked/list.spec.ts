import {ByteEnvelope} from '../../../src/byte/envelope';
import {ByteLinkedList} from '../../../src/byte/linked/list';
import {type ItemCodec} from '../../../src/item/codec';
import {LinkedList} from '../../../src/linked/list';

/** Codec for small non-negative integers: one byte each. */
const codec: ItemCodec<number> = {
	encode: (item) => new Uint8Array([item]),
	decode: (bytes) => bytes[0]
};

const values = (list: LinkedList<number>): Array<number | null> => list.toArray().map((e) => e.value());

describe('ByteLinkedList', () => {
	describe('constructor', () => {
		it('is a LinkedList', () => {
			const result = new ByteLinkedList(codec);

			expect(result).toBeInstanceOf(ByteLinkedList);
			expect(result).toBeInstanceOf(LinkedList);
			expect(result.size()).toBe(0);
			expect(result.codec).toBe(codec);
		});

		it('with elements', () => {
			const result = new ByteLinkedList(codec, [7, 8, 9]);

			expect(result.size()).toBe(3);
			expect(values(result)).toEqual([7, 8, 9]);
		});

		it('from envelope bytes', () => {
			const bytes = new ByteLinkedList(codec, [7, 8, 9]).toBytes();
			const result = new ByteLinkedList(codec, bytes);

			expect(values(result)).toEqual([7, 8, 9]);
		});

		it('from empty envelope bytes', () => {
			const bytes = new ByteLinkedList(codec).toBytes();

			expect(new ByteLinkedList(codec, bytes).size()).toBe(0);
			expect(new ByteLinkedList(codec, bytes, null).size()).toBe(0);
		});

		it('ignores invalid data instead of throwing', () => {
			expect(new ByteLinkedList(codec, null).size()).toBe(0);
			expect(new ByteLinkedList(codec, 'adsf' as any).size()).toBe(0);
			expect(new ByteLinkedList(codec, {elements: [4]} as any).size()).toBe(0);
		});

		it('throws without a valid codec', () => {
			expect(() => new (ByteLinkedList as any)()).toThrow();
			expect(() => new (ByteLinkedList as any)(null, [1])).toThrow();
			expect(() => new (ByteLinkedList as any)({encode: codec.encode}, [1])).toThrow();
			expect(() => new (ByteLinkedList as any)({decode: codec.decode}, [1])).toThrow();
			expect(() => new (ByteLinkedList as any)({encode: 'nope', decode: 'nope'}, [1])).toThrow();
			expect(() => new ByteLinkedList(codec, [1])).not.toThrow();
		});

		it('throws on bytes that are not a valid envelope', () => {
			expect(() => new ByteLinkedList(codec, new Uint8Array([1, 2, 3]))).toThrow();
		});
	});

	describe('toByteEnvelope', () => {
		it('encodes each value head to tail', () => {
			const encode = jest.fn(codec.encode);
			const source = new ByteLinkedList<number>({encode, decode: codec.decode}, [2, 3]);
			source.insertAtHead(1);

			const envelope = source.toByteEnvelope();

			expect(envelope).toBeInstanceOf(ByteEnvelope);
			expect(encode).toHaveBeenCalledTimes(3);
			expect(envelope.items()).toEqual([new Uint8Array([1]), new Uint8Array([2]), new Uint8Array([3])]);
		});

		it('skips elements whose value is null', () => {
			const source = new ByteLinkedList(codec, [1, 2, 3]);
			source.head()?.value(null as any);

			expect(source.toByteEnvelope().size()).toBe(2);
		});

		it('empty list produces an empty envelope', () => {
			expect(new ByteLinkedList(codec).toByteEnvelope().size()).toBe(0);
		});
	});

	describe('toBytes', () => {
		it('returns the serialized envelope', () => {
			const source = new ByteLinkedList(codec, [1, 2, 3]);

			expect(source.toBytes()).toEqual(source.toByteEnvelope().toBytes());
			expect(ByteEnvelope.fromBytes(source.toBytes())?.decode(codec.decode)).toEqual([1, 2, 3]);
		});

		it('round trips', () => {
			const source = new ByteLinkedList(codec, [10, 20, 30]);
			const bytes = source.toBytes();
			const result = new ByteLinkedList(codec, bytes);

			expect(values(result)).toEqual([10, 20, 30]);
			expect(result.stringify()).toBe(source.stringify());
			expect(result.toBytes()).toEqual(bytes);
		});
	});

	describe('inherited behavior', () => {
		it('filter returns a ByteLinkedList with the same codec', () => {
			const source = new ByteLinkedList(codec, [1, 2, 3]);
			const filtered = source.filter((e) => (e.value() as number) > 1);

			expect(filtered).toBeInstanceOf(ByteLinkedList);
			expect(filtered.codec).toBe(codec);
			expect(values(filtered)).toEqual([2, 3]);
			expect(filtered.toByteEnvelope().size()).toBe(2);
		});

		it('filter honors thisArg', () => {
			const source = new ByteLinkedList(codec, [1, 2, 3]);
			const ctx = {min: 2};
			const filtered = source.filter(function (this: typeof ctx, e) {
				return (e.value() as number) >= this.min;
			}, ctx);

			expect(values(filtered)).toEqual([2, 3]);
		});

		it('reset keeps the codec', () => {
			const source = new ByteLinkedList(codec, [1, 2, 3]);
			source.reset();

			expect(source.size()).toBe(0);
			expect(source.codec).toBe(codec);
			expect(source.toByteEnvelope().size()).toBe(0);
		});

		it('reverse then encode', () => {
			const source = new ByteLinkedList(codec, [1, 2, 3]);
			source.reverse();

			expect(source.toByteEnvelope().decode(codec.decode)).toEqual([3, 2, 1]);
		});
	});
});
