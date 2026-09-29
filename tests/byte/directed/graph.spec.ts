import {ByteDirectedGraph} from '../../../src/byte/directed/graph';
import {ByteEnvelope} from '../../../src/byte/envelope';
import {ByteGraphEnvelope} from '../../../src/byte/envelope/graph';
import {DirectedGraph} from '../../../src/directed/graph';
import {type DirectedGraphEdge} from '../../../src/directed/graph/edge';
import {type ItemCodec} from '../../../src/item/codec';

/** Codec for small non-negative integers: one byte each. */
const codec: ItemCodec<number> = {
	encode: (item) => new Uint8Array([item]),
	decode: (bytes) => bytes[0]
};

type Edge = DirectedGraphEdge<number>;

/** Edge list as plain records, by vertex index, in edge order. */
const edgesOf = (graph: DirectedGraph<number>): unknown[] => JSON.parse(graph.stringify() as string).edges;

/** Graph over items 0..count-1 with a mix of edge kinds, weights, and a loop. */
const sample = (): ByteDirectedGraph<number> => {
	const graph = new ByteDirectedGraph(codec, [10, 11, 12, 13]);
	const [a, b, c, d] = graph.vertices();
	graph.addEdge(a, b, 2.5);
	graph.addBidirectionalEdge(c, a, 0);
	graph.addEdge(b, a, 1e-9);
	graph.addEdge(d, d, 7);
	graph.addBidirectionalEdge(b, b);
	graph.addEdge(c, d, 123456.789);

	return graph;
};

describe('ByteDirectedGraph', () => {
	describe('constructor', () => {
		it('is a DirectedGraph', () => {
			const result = new ByteDirectedGraph(codec);

			expect(result).toBeInstanceOf(ByteDirectedGraph);
			expect(result).toBeInstanceOf(DirectedGraph);
			expect(result.size()).toBe(0);
			expect(result.codec).toBe(codec);
		});

		it('with items added as vertices, without edges', () => {
			const result = new ByteDirectedGraph(codec, [7, 8, 9]);

			expect(result.values()).toEqual([7, 8, 9]);
			expect(result.edgeCount()).toBe(0);
		});

		it('from graph bytes, rebuilding every vertex and edge', () => {
			const source = sample();
			const result = new ByteDirectedGraph(codec, source.toBytes());

			expect(result.values()).toEqual([10, 11, 12, 13]);
			expect(result.edgeCount()).toBe(6);
			expect(edgesOf(result)).toEqual(edgesOf(source));

			const [a, b, c, d] = result.vertices();
			expect(result.adjacent(a, c)).toBe(true);
			expect(result.adjacent(c, a)).toBe(true);
			expect(result.adjacent(a, d)).toBe(false);
			expect((result.edge(c, a) as Edge).isBidirectional()).toBe(true);
			expect((result.edge(a, b) as Edge).weight()).toBe(2.5);
			expect(result.findPath(a, d)?.cost).toBe(123456.789);
		});

		it('from empty graph bytes', () => {
			const bytes = new ByteDirectedGraph(codec).toBytes();

			expect(new ByteDirectedGraph(codec, bytes).size()).toBe(0);
			expect(new ByteDirectedGraph(codec, bytes, null).size()).toBe(0);
		});

		it('ignores invalid data instead of throwing', () => {
			expect(new ByteDirectedGraph(codec, null).size()).toBe(0);
			expect(new ByteDirectedGraph(codec, 'adsf' as any).size()).toBe(0);
			expect(new ByteDirectedGraph(codec, {elements: [4]} as any).size()).toBe(0);
		});

		it('throws without a valid codec', () => {
			expect(() => new (ByteDirectedGraph as any)()).toThrow();
			expect(() => new (ByteDirectedGraph as any)(null, [1])).toThrow();
			expect(() => new (ByteDirectedGraph as any)({encode: codec.encode}, [1])).toThrow();
			expect(() => new (ByteDirectedGraph as any)({decode: codec.decode}, [1])).toThrow();
			expect(() => new ByteDirectedGraph(codec, [1])).not.toThrow();
		});

		it('throws on malformed bytes before decoding any item', () => {
			const decode = jest.fn(codec.decode);
			const strict: ItemCodec<number> = {encode: codec.encode, decode};
			const good = sample().toBytes();
			const view = (bytes: Uint8Array): DataView => new DataView(bytes.buffer);
			const envelopeLength = view(good).getUint32(5, true);
			const firstRecord =
				ByteGraphEnvelope.HeaderSize + envelopeLength + ByteGraphEnvelope.EdgeCountSize;

			const cases: Uint8Array[] = [
				new Uint8Array(0),
				good.slice(0, good.length - 1),
				ByteEnvelope.encode([1, 2], codec.encode).toBytes(),
				((): Uint8Array => {
					const bytes = good.slice();
					view(bytes).setUint32(firstRecord + 4, 99, true);
					return bytes;
				})(),
				((): Uint8Array => {
					const bytes = good.slice();
					view(bytes).setFloat64(firstRecord + 8, -2, true);
					return bytes;
				})(),
				((): Uint8Array => {
					const bytes = good.slice();
					view(bytes).setFloat64(firstRecord + 8, NaN, true);
					return bytes;
				})(),
				((): Uint8Array => {
					const bytes = good.slice();
					bytes[firstRecord + 16] = 4;
					return bytes;
				})(),
				((): Uint8Array => {
					// Third record (b>a) rewritten as a copy of the first (a>b).
					const bytes = good.slice();
					bytes.copyWithin(
						firstRecord + 2 * ByteGraphEnvelope.EdgeSize,
						firstRecord,
						firstRecord + ByteGraphEnvelope.EdgeSize
					);
					return bytes;
				})()
			];

			for (const bytes of cases) {
				expect(() => new ByteDirectedGraph(strict, bytes)).toThrow('ByteGraphEnvelope');
			}
			expect(decode).not.toHaveBeenCalled();
		});

		it('passes options to the base class', () => {
			const result = new ByteDirectedGraph(codec, sample().toBytes(), {disableElementPooling: true});

			expect((result as any).vertexPool.enabled()).toBe(false);
			expect(result.edgeCount()).toBe(6);
		});

		it('propagates a throwing codec', () => {
			const broken: ItemCodec<number> = {
				encode: () => {
					throw new Error('encode');
				},
				decode: () => {
					throw new Error('decode');
				}
			};

			expect(() => new ByteDirectedGraph(broken, [1]).toBytes()).toThrow('encode');
			expect(() => new ByteDirectedGraph(broken, sample().toBytes())).toThrow('decode');
		});
	});

	describe('toBytes', () => {
		it('round trips byte for byte', () => {
			const bytes = sample().toBytes();
			const again = new ByteDirectedGraph(codec, bytes).toBytes();

			expect(again).toEqual(bytes);
			expect(new ByteDirectedGraph(codec, again).toBytes()).toEqual(bytes);
		});

		it('round trips after edits recycle vertices and edges', () => {
			const graph = sample();
			const [a, b] = graph.vertices();
			graph.removeVertex(a);
			const e = graph.addVertex(14);
			graph.addEdge(e, b, 3);
			graph.removeEdge(graph.edge(b, b));

			const bytes = graph.toBytes();
			const result = new ByteDirectedGraph(codec, bytes);

			expect(result.values()).toEqual([11, 12, 13, 14]);
			expect(edgesOf(result)).toEqual(edgesOf(graph));
			expect(result.toBytes()).toEqual(bytes);
		});

		it('writes vertices in insertion order and edges by vertex index', () => {
			const graph = new ByteDirectedGraph(codec, [5, 6]);
			const [a, b] = graph.vertices();
			graph.addBidirectionalEdge(b, a, 4);
			const envelope = ByteGraphEnvelope.fromBytes(graph.toBytes()) as ByteGraphEnvelope;

			expect(envelope.vertices().decode(codec.decode)).toEqual([5, 6]);
			expect(envelope.edges()).toEqual([{from: 1, to: 0, weight: 4, bidirectional: true}]);
		});

		it('equals toByteGraphEnvelope().toBytes()', () => {
			const graph = sample();

			expect(graph.toBytes()).toEqual(graph.toByteGraphEnvelope().toBytes());
		});
	});

	describe('toByteEnvelope', () => {
		it('holds vertex items in insertion order, without edges', () => {
			const envelope = sample().toByteEnvelope();

			expect(envelope).toBeInstanceOf(ByteEnvelope);
			expect(envelope.decode(codec.decode)).toEqual([10, 11, 12, 13]);
		});
	});

	describe('filter', () => {
		it('keeps the codec, options, and edges between kept vertices', () => {
			const graph = new ByteDirectedGraph(codec, [1, 2, 3], {disableElementPooling: true});
			const [a, b, c] = graph.vertices();
			graph.addEdge(a, b, 2);
			graph.addBidirectionalEdge(b, c);
			const kept = graph.filter((vertex) => vertex.value() !== 3);

			expect(kept).toBeInstanceOf(ByteDirectedGraph);
			expect(kept.codec).toBe(codec);
			expect((kept as any).vertexPool.enabled()).toBe(false);
			expect(kept.values()).toEqual([1, 2]);
			expect(edgesOf(kept)).toEqual([{from: 0, to: 1, weight: 2, bidirectional: false}]);
			expect(new ByteDirectedGraph(codec, kept.toBytes()).toBytes()).toEqual(kept.toBytes());
		});
	});
});
