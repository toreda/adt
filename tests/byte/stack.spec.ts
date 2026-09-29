import {ByteEnvelope} from '../../src/byte/envelope';
import {ByteStack} from '../../src/byte/stack';
import {type ItemCodec} from '../../src/item/codec';
import {Stack} from '../../src/stack';

/** Codec for small non-negative integers: one byte each. */
const codec: ItemCodec<number> = {
	encode: (item) => new Uint8Array([item]),
	decode: (bytes) => bytes[0]
};

describe('ByteStack', () => {
	describe('constructor', () => {
		it('is a Stack', () => {
			const result = new ByteStack(codec);

			expect(result).toBeInstanceOf(ByteStack);
			expect(result).toBeInstanceOf(Stack);
			expect(result.size()).toBe(0);
			expect(result.codec).toBe(codec);
		});

		it('with items pushed bottom to top', () => {
			const result = new ByteStack(codec, [7, 8, 9]);

			expect(result.state.elements).toEqual([7, 8, 9]);
			expect(result.top()).toBe(9);
			expect(result.bottom()).toBe(7);
		});

		it('pushes data on top of options.elements', () => {
			const result = new ByteStack(codec, [3, 4], {elements: [1, 2]});

			expect(result.state.elements).toEqual([1, 2, 3, 4]);
		});

		it('from envelope bytes keeps the same top', () => {
			const bytes = new ByteStack(codec, [7, 8, 9]).toBytes();
			const result = new ByteStack(codec, bytes);

			expect(result.top()).toBe(9);
			expect(result.bottom()).toBe(7);
			expect(result.state.elements).toEqual([7, 8, 9]);
		});

		it('from empty envelope bytes', () => {
			const bytes = new ByteStack(codec).toBytes();

			expect(bytes.length).toBe(ByteEnvelope.HeaderSize);
			expect(new ByteStack(codec, bytes).size()).toBe(0);
			expect(new ByteStack(codec, bytes, null).size()).toBe(0);
		});

		it('ignores invalid data instead of throwing', () => {
			expect(new ByteStack(codec, null).size()).toBe(0);
			expect(new ByteStack(codec, 'adsf' as any).size()).toBe(0);
			expect(new ByteStack(codec, {elements: [4]} as any).size()).toBe(0);
		});

		it('throws without a valid codec', () => {
			expect(() => new (ByteStack as any)()).toThrow();
			expect(() => new (ByteStack as any)(null, [1])).toThrow();
			expect(() => new (ByteStack as any)({encode: codec.encode}, [1])).toThrow();
			expect(() => new (ByteStack as any)({decode: codec.decode}, [1])).toThrow();
			expect(() => new ByteStack(codec, [1])).not.toThrow();
		});

		it('throws on bytes that are not a valid envelope', () => {
			expect(() => new ByteStack(codec, new Uint8Array([1, 2, 3]))).toThrow();
		});
	});

	describe('toByteEnvelope / toBytes', () => {
		it('encodes each item top to bottom', () => {
			const source = new ByteStack(codec, [1, 2, 3]);
			const envelope = source.toByteEnvelope();

			expect(envelope).toBeInstanceOf(ByteEnvelope);
			expect(envelope.decode(codec.decode)).toEqual([3, 2, 1]);
			expect(source.toBytes()).toEqual(envelope.toBytes());
		});

		it('matches forEach and iteration order', () => {
			const source = new ByteStack(codec, [4, 5, 6]);
			const visited: number[] = [];
			source.forEach((item) => visited.push(item));

			expect(source.toByteEnvelope().decode(codec.decode)).toEqual(visited);
			expect([...source]).toEqual(visited);
		});

		it('encodes only live items after pops and clears', () => {
			const source = new ByteStack(codec, [1, 2, 3, 4, 5]);
			source.pop();
			source.pop();

			expect(source.toByteEnvelope().decode(codec.decode)).toEqual([3, 2, 1]);
			expect(new ByteStack(codec, source.toBytes()).values()).toEqual([3, 2, 1]);

			source.clearElements();
			source.push(9);
			expect(source.toByteEnvelope().decode(codec.decode)).toEqual([9]);
		});

		it('round trips byte for byte', () => {
			const source = new ByteStack(codec, [10, 20, 30, 20]);
			const bytes = source.toBytes();
			const result = new ByteStack(codec, bytes);

			expect(result.state.elements).toEqual([10, 20, 30, 20]);
			expect(result.stringify()).toBe(source.stringify());
			expect(result.toBytes()).toEqual(bytes);
		});
	});

	describe('inherited behavior', () => {
		it('filter returns a ByteStack with the same codec and order', () => {
			const source = new ByteStack(codec, [1, 2, 3, 4]);
			const filtered = source.filter((item) => item % 2 === 0);

			expect(filtered).toBeInstanceOf(ByteStack);
			expect(filtered.codec).toBe(codec);
			expect(filtered.state.elements).toEqual([2, 4]);
			expect(filtered.top()).toBe(4);
		});

		it('filter honors thisArg', () => {
			const source = new ByteStack(codec, [1, 2, 3]);
			const ctx = {min: 2};
			const filtered = source.filter(function (this: typeof ctx, item) {
				return item >= this.min;
			}, ctx);

			expect(filtered.state.elements).toEqual([2, 3]);
		});

		it('reset keeps the codec', () => {
			const source = new ByteStack(codec, [1, 2, 3]);
			source.reset();

			expect(source.size()).toBe(0);
			expect(source.codec).toBe(codec);
			expect(source.toByteEnvelope().size()).toBe(0);
		});
	});
});
