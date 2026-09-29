import {ByteEnvelope} from '../../../src/byte/envelope';
import {BytePriorityQueue} from '../../../src/byte/priority/queue';
import {type ItemCodec} from '../../../src/item/codec';
import {PriorityQueue} from '../../../src/priority/queue';

/** Codec for small non-negative integers: one byte each. */
const codec: ItemCodec<number> = {
	encode: (item) => new Uint8Array([item]),
	decode: (bytes) => bytes[0]
};

const minFirst = (a: number, b: number): boolean => a < b;

const heapOrder = (queue: PriorityQueue<number>): number[] => {
	const out: number[] = [];
	queue.forEach((item) => out.push(item));
	return out;
};

const drain = (queue: PriorityQueue<number>): number[] => {
	const out: number[] = [];
	while (!queue.isEmpty()) {
		out.push(queue.pop() as number);
	}
	return out;
};

describe('BytePriorityQueue', () => {
	describe('constructor', () => {
		it('is a PriorityQueue', () => {
			const result = new BytePriorityQueue(codec, minFirst);

			expect(result).toBeInstanceOf(BytePriorityQueue);
			expect(result).toBeInstanceOf(PriorityQueue);
			expect(result.size()).toBe(0);
			expect(result.codec).toBe(codec);
		});

		it('with items', () => {
			const result = new BytePriorityQueue(codec, minFirst, [5, 1, 4, 2, 3]);

			expect(result.peek()).toBe(1);
			expect(drain(result)).toEqual([1, 2, 3, 4, 5]);
		});

		it('adds data after options.elements', () => {
			const result = new BytePriorityQueue(codec, minFirst, [3, 0], {elements: [2, 1]});

			expect(drain(result)).toEqual([0, 1, 2, 3]);
		});

		it('from envelope bytes', () => {
			const bytes = new BytePriorityQueue(codec, minFirst, [5, 1, 4, 2, 3]).toBytes();

			expect(drain(new BytePriorityQueue(codec, minFirst, bytes))).toEqual([1, 2, 3, 4, 5]);
		});

		it('from empty envelope bytes', () => {
			const bytes = new BytePriorityQueue(codec, minFirst).toBytes();

			expect(bytes.length).toBe(ByteEnvelope.HeaderSize);
			expect(new BytePriorityQueue(codec, minFirst, bytes).size()).toBe(0);
			expect(new BytePriorityQueue(codec, minFirst, bytes, null).size()).toBe(0);
		});

		it('ignores invalid data instead of throwing', () => {
			expect(new BytePriorityQueue(codec, minFirst, null).size()).toBe(0);
			expect(new BytePriorityQueue(codec, minFirst, 'adsf' as any).size()).toBe(0);
			expect(new BytePriorityQueue(codec, minFirst, {elements: [4]} as any).size()).toBe(0);
		});

		it('throws without a valid codec', () => {
			expect(() => new (BytePriorityQueue as any)(undefined, minFirst)).toThrow();
			expect(() => new (BytePriorityQueue as any)(null, minFirst, [1])).toThrow();
			expect(() => new (BytePriorityQueue as any)({encode: codec.encode}, minFirst, [1])).toThrow();
			expect(() => new (BytePriorityQueue as any)({decode: codec.decode}, minFirst, [1])).toThrow();
			expect(() => new BytePriorityQueue(codec, minFirst, [1])).not.toThrow();
		});

		it('throws without a comparator', () => {
			expect(() => new (BytePriorityQueue as any)(codec)).toThrow();
			expect(() => new (BytePriorityQueue as any)(codec, null, [1])).toThrow();
		});

		it('throws on bytes that are not a valid envelope', () => {
			expect(() => new BytePriorityQueue(codec, minFirst, new Uint8Array([1, 2, 3]))).toThrow();
		});
	});

	describe('toByteEnvelope / toBytes', () => {
		it('encodes each item in heap array order', () => {
			const source = new BytePriorityQueue(codec, minFirst, [5, 1, 4, 2, 3]);
			const envelope = source.toByteEnvelope();

			expect(envelope).toBeInstanceOf(ByteEnvelope);
			expect(envelope.decode(codec.decode)).toEqual(heapOrder(source));
			expect(source.toBytes()).toEqual(envelope.toBytes());
		});

		it('rebuilds the identical heap and round trips byte for byte', () => {
			const source = new BytePriorityQueue(codec, minFirst, [9, 3, 7, 3, 1, 8, 1, 5, 5, 0, 2]);
			source.pop();
			source.push(4);
			const bytes = source.toBytes();
			const result = new BytePriorityQueue(codec, minFirst, bytes);

			expect(heapOrder(result)).toEqual(heapOrder(source));
			expect(result.stringify()).toBe(source.stringify());
			expect(result.toBytes()).toEqual(bytes);
		});

		it('encodes only live items after pops and clears', () => {
			const source = new BytePriorityQueue(codec, minFirst, [9, 3, 7, 1, 8, 5]);
			source.pop();
			source.pop();

			expect(source.toByteEnvelope().size()).toBe(4);
			expect(drain(new BytePriorityQueue(codec, minFirst, source.toBytes()))).toEqual([5, 7, 8, 9]);

			source.clearElements();
			source.push(2);
			expect(source.toByteEnvelope().decode(codec.decode)).toEqual([2]);
		});

		it('round trips a heap of equal priorities', () => {
			// Same priority (high nibble), distinct identities (low nibble).
			const byPriority = (a: number, b: number): boolean => a >> 4 < b >> 4;
			const source = new BytePriorityQueue(codec, byPriority, [0x11, 0x12, 0x13, 0x14, 0x15]);
			const bytes = source.toBytes();
			const result = new BytePriorityQueue(codec, byPriority, bytes);

			expect(heapOrder(result)).toEqual([0x11, 0x12, 0x13, 0x14, 0x15]);
			expect(result.toBytes()).toEqual(bytes);
		});
	});

	describe('inherited behavior', () => {
		it('filter returns a BytePriorityQueue with the same codec and comparator', () => {
			const source = new BytePriorityQueue(codec, minFirst, [6, 1, 5, 2, 4, 3]);
			const filtered = source.filter((item) => item % 2 === 0);

			expect(filtered).toBeInstanceOf(BytePriorityQueue);
			expect(filtered.codec).toBe(codec);
			expect(drain(filtered)).toEqual([2, 4, 6]);
			expect(source.size()).toBe(6);
		});

		it('filter passes the source queue itself as the third argument', () => {
			const source = new BytePriorityQueue(codec, minFirst, [3, 1, 2]);
			const thirds: unknown[] = [];
			source.filter((_item, _i, queue) => {
				thirds.push(queue);
				return true;
			});

			expect(thirds).toEqual([source, source, source]);
			expect(thirds[0]).toBe(source);
		});

		it('filter honors thisArg', () => {
			const source = new BytePriorityQueue(codec, minFirst, [1, 2, 3]);
			const ctx = {min: 2};
			const filtered = source.filter(function (this: typeof ctx, item) {
				return item >= this.min;
			}, ctx);

			expect(drain(filtered)).toEqual([2, 3]);
		});

		it('reset keeps the codec', () => {
			const source = new BytePriorityQueue(codec, minFirst, [1, 2, 3]);
			source.reset();

			expect(source.size()).toBe(0);
			expect(source.codec).toBe(codec);
			expect(source.toByteEnvelope().size()).toBe(0);
		});
	});
});
