import {ByteEnvelope} from '../../../src/byte/envelope';
import {ByteQuadTree} from '../../../src/byte/quad/tree';
import {type ItemCodec} from '../../../src/item/codec';
import {QuadTree} from '../../../src/quad/tree';
import type {QuadTreePoint} from '../../../src/quad/tree/point';

interface Pt {
	x: number;
	y: number;
	id: number;
}

/** Codec for points: three float64 values each. */
const codec: ItemCodec<Pt> = {
	encode: (item) => new Uint8Array(new Float64Array([item.x, item.y, item.id]).buffer),
	decode: (bytes) => {
		const view = new Float64Array(bytes.slice().buffer);
		return {x: view[0], y: view[1], id: view[2]};
	}
};

const byPoint = (item: Pt): QuadTreePoint => item;

/** Deterministic pseudo random points, rounded so shared coordinates show up. */
const randomPoints = (count: number, seed: number): Pt[] => {
	let state = seed;
	const random = (): number => {
		state = (state * 1664525 + 1013904223) % 4294967296;
		return state / 4294967296;
	};
	const result: Pt[] = [];

	for (let i = 0; i < count; i++) {
		result.push({x: Math.round(random() * 100), y: Math.round(random() * 100), id: i});
	}

	return result;
};

/** Shape fingerprint: each node's id with its parent's id and quadrant, in pre-order. */
const shape = (tree: QuadTree<Pt>): string[] =>
	tree.toArray().map((n) => `${n.value()!.id}<${n.parent()?.value()!.id ?? '-'}@${n.quadrant()}`);

describe('ByteQuadTree', () => {
	describe('constructor', () => {
		it('is a QuadTree', () => {
			const result = new ByteQuadTree(codec, byPoint);

			expect(result).toBeInstanceOf(ByteQuadTree);
			expect(result).toBeInstanceOf(QuadTree);
			expect(result.size()).toBe(0);
			expect(result.codec).toBe(codec);
			expect(result.locator).toBe(byPoint);
		});

		it('with items', () => {
			const items = randomPoints(20, 1);
			const result = new ByteQuadTree(codec, byPoint, items);

			expect(result.size()).toBe(20);
			expect(result.preOrder()).toEqual(new QuadTree(byPoint, items).preOrder());
		});

		it('from envelope bytes, rebuilding the same shape', () => {
			const source = new ByteQuadTree(codec, byPoint, randomPoints(200, 2));
			const result = new ByteQuadTree(codec, byPoint, source.toBytes());

			expect(result.size()).toBe(200);
			expect(result.preOrder()).toEqual(source.preOrder());
			expect(shape(result)).toEqual(shape(source));
		});

		it('from empty envelope bytes', () => {
			const bytes = new ByteQuadTree(codec, byPoint).toBytes();

			expect(bytes.length).toBe(ByteEnvelope.HeaderSize);
			expect(new ByteQuadTree(codec, byPoint, bytes).size()).toBe(0);
			expect(new ByteQuadTree(codec, byPoint, bytes, null).size()).toBe(0);
		});

		it('passes options through', () => {
			const bytes = new ByteQuadTree(codec, byPoint, [
				{x: 1, y: 1, id: 0},
				{x: 1, y: 1, id: 1}
			]).toBytes();
			const unique = new ByteQuadTree(codec, byPoint, bytes, {allowDuplicates: false});

			expect(unique.allowDuplicates).toBe(false);
			expect(unique.size()).toBe(1);
		});

		it('ignores invalid data instead of throwing', () => {
			expect(new ByteQuadTree(codec, byPoint, null).size()).toBe(0);
			expect(new ByteQuadTree(codec, byPoint, 'adsf' as any).size()).toBe(0);
			expect(new ByteQuadTree(codec, byPoint, {elements: []} as any).size()).toBe(0);
		});

		it('throws without a valid codec', () => {
			expect(() => new (ByteQuadTree as any)()).toThrow();
			expect(() => new (ByteQuadTree as any)(null, byPoint, [])).toThrow();
			expect(() => new (ByteQuadTree as any)({encode: codec.encode}, byPoint, [])).toThrow();
			expect(() => new (ByteQuadTree as any)({decode: codec.decode}, byPoint, [])).toThrow();
			expect(() => new ByteQuadTree(codec, byPoint, [])).not.toThrow();
		});

		it('throws without a locator', () => {
			expect(() => new (ByteQuadTree as any)(codec)).toThrow();
			expect(() => new (ByteQuadTree as any)(codec, null, [])).toThrow();
		});

		it('throws on bytes that are not a valid envelope', () => {
			expect(() => new ByteQuadTree(codec, byPoint, new Uint8Array([1, 2, 3]))).toThrow();
		});
	});

	describe('toByteEnvelope', () => {
		it('encodes each item in pre-order', () => {
			const encode = jest.fn(codec.encode);
			const source = new ByteQuadTree<Pt>({encode, decode: codec.decode}, byPoint, randomPoints(30, 3));

			const envelope = source.toByteEnvelope();

			expect(envelope).toBeInstanceOf(ByteEnvelope);
			expect(encode).toHaveBeenCalledTimes(30);
			expect(envelope.decode(codec.decode)).toEqual(source.preOrder());
		});
	});

	describe('toBytes', () => {
		it('round-trips byte for byte', () => {
			const source = new ByteQuadTree(codec, byPoint, randomPoints(300, 4));
			// Removal relinks, so the pre-order differs from insertion order.
			source.remove(source.root()!.value()!);
			const bytes = source.toBytes();
			const copy = new ByteQuadTree(codec, byPoint, bytes);

			expect(copy.toBytes()).toEqual(bytes);
			expect(shape(copy)).toEqual(shape(source));
		});

		it('equals toByteEnvelope().toBytes()', () => {
			const source = new ByteQuadTree(codec, byPoint, randomPoints(10, 5));

			expect(source.toBytes()).toEqual(source.toByteEnvelope().toBytes());
		});
	});

	describe('filter', () => {
		it('keeps the codec, locator, and options', () => {
			const source = new ByteQuadTree(codec, byPoint, randomPoints(50, 6), {
				allowDuplicates: false,
				disableElementPooling: true
			});
			const result = source.filter((elem) => elem.x() < 50);

			expect(result).toBeInstanceOf(ByteQuadTree);
			expect(result.codec).toBe(codec);
			expect(result.locator).toBe(byPoint);
			expect(result.allowDuplicates).toBe(false);
			expect((result as any).elements.objectPool).toBeNull();
			expect(result.values().every((p) => p.x < 50)).toBe(true);
			expect(new ByteQuadTree(codec, byPoint, result.toBytes()).preOrder()).toEqual(result.preOrder());
		});
	});
});
