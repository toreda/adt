import {ByteEnvelope} from '../../../src/byte/envelope';
import {ByteSpatialMap} from '../../../src/byte/spatial/map';
import {type ItemCodec} from '../../../src/item/codec';
import {SpatialMap} from '../../../src/spatial/map';
import {byPoint, type Pt, seeded} from '../../spatial/_helpers';

/** Points spaced 10 apart on x, so each holds its own cell at every cell size used here. */
const randomPoints = (count: number, seed: number): Pt[] => {
	const random = seeded(seed);
	const result: Pt[] = [];

	for (let i = 0; i < count; i++) {
		result.push({x: 10 * i + random(), y: (random() * 2 - 1) * 50, z: (random() * 2 - 1) * 50, id: i});
	}

	return result;
};

/** Codec for points: four float64 values each. */
const codec: ItemCodec<Pt> = {
	encode: (item) => new Uint8Array(new Float64Array([item.x, item.y, item.z, item.id!]).buffer),
	decode: (bytes) => {
		const view = new Float64Array(bytes.slice().buffer);
		return {x: view[0], y: view[1], z: view[2], id: view[3]};
	}
};

describe('ByteSpatialMap', () => {
	describe('constructor', () => {
		it('is a SpatialMap', () => {
			const result = new ByteSpatialMap(codec, byPoint);

			expect(result).toBeInstanceOf(SpatialMap);
			expect(result.size()).toBe(0);
			expect(result.codec).toBe(codec);
			expect(result.locator).toBe(byPoint);
		});

		it('with items', () => {
			const items = randomPoints(20, 1);

			expect(new ByteSpatialMap(codec, byPoint, items).values()).toEqual(items);
		});

		it('from envelope bytes, restoring insertion order', () => {
			const source = new ByteSpatialMap(codec, byPoint, randomPoints(200, 2), {cellSize: 3});
			const result = new ByteSpatialMap(codec, byPoint, source.toBytes(), {cellSize: 3});

			expect(result.size()).toBe(200);
			expect(result.values()).toEqual(source.values());
			expect(result.toBytes()).toEqual(source.toBytes());
		});

		it('from empty envelope bytes', () => {
			const bytes = new ByteSpatialMap(codec, byPoint).toBytes();

			expect(bytes.length).toBe(ByteEnvelope.HeaderSize);
			expect(new ByteSpatialMap(codec, byPoint, bytes).size()).toBe(0);
		});

		it('passes options through', () => {
			const result = new ByteSpatialMap(codec, byPoint, null, {cellSize: 8});

			expect(result.cellSize).toBe(8);
		});

		it('ignores other data', () => {
			expect(new ByteSpatialMap(codec, byPoint, 'x' as any).size()).toBe(0);
		});

		it('throws for an invalid codec', () => {
			expect(() => new ByteSpatialMap(null as any, byPoint)).toThrow(
				'ByteSpatialMap requires an ItemCodec with encode and decode functions'
			);
			expect(() => new ByteSpatialMap({encode: codec.encode} as any, byPoint)).toThrow();
		});

		it('throws for an invalid locator', () => {
			expect(() => new ByteSpatialMap(codec, null as any)).toThrow(
				'SpatialMap requires a locator function'
			);
		});

		it('throws for malformed bytes', () => {
			expect(() => new ByteSpatialMap(codec, byPoint, new Uint8Array([1, 2, 3]))).toThrow();
		});
	});

	describe('encoding', () => {
		it('toByteEnvelope holds each item in insertion order', () => {
			const items = randomPoints(10, 3);
			const envelope = new ByteSpatialMap(codec, byPoint, items).toByteEnvelope();

			expect(envelope.size()).toBe(10);
			expect(envelope.decode(codec.decode)).toEqual(items);
		});

		it('toBytes matches the envelope bytes', () => {
			const target = new ByteSpatialMap(codec, byPoint, randomPoints(5, 4));

			expect(target.toBytes()).toEqual(target.toByteEnvelope().toBytes());
		});

		it('filter keeps the codec, locator, and options', () => {
			const target = new ByteSpatialMap(codec, byPoint, randomPoints(20, 5), {cellSize: 2});
			const result = target.filter((element) => element.value()!.id! % 2 === 0);

			expect(result).toBeInstanceOf(ByteSpatialMap);
			expect(result.codec).toBe(codec);
			expect(result.cellSize).toBe(2);
			expect(result.values()).toEqual(target.values().filter((p) => p.id! % 2 === 0));
		});
	});
});
