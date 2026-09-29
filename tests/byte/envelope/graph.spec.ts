import {ByteEnvelope} from '../../../src/byte/envelope';
import {type ByteGraphEnvelopeEdge} from '../../../src/byte/envelope/edge';
import {ByteGraphEnvelope} from '../../../src/byte/envelope/graph';

const encodeItem = (item: number): Uint8Array => new Uint8Array([item]);

const view = (bytes: Uint8Array): DataView => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

const edge = (from: number, to: number, weight = 1, bidirectional = false): ByteGraphEnvelopeEdge => ({
	from,
	to,
	weight,
	bidirectional
});

/** Graph envelope bytes with the given vertex count (items 0..n-1) and edges. */
const make = (vertexCount: number, edges: ByteGraphEnvelopeEdge[]): Uint8Array => {
	const items = new Array(vertexCount).fill(0).map((_, i) => i);
	return new ByteGraphEnvelope(ByteEnvelope.encode(items, encodeItem), edges).toBytes();
};

/** Offset of edge record i in bytes. */
const recordAt = (bytes: Uint8Array, i: number): number => {
	const envelopeLength = view(bytes).getUint32(5, true);
	return (
		ByteGraphEnvelope.HeaderSize +
		envelopeLength +
		ByteGraphEnvelope.EdgeCountSize +
		i * ByteGraphEnvelope.EdgeSize
	);
};

describe('ByteGraphEnvelope', () => {
	describe('constructor', () => {
		it('starts empty by default', () => {
			for (const result of [new ByteGraphEnvelope(), new ByteGraphEnvelope(null, null)]) {
				expect(result.size()).toBe(0);
				expect(result.edgeCount()).toBe(0);
				expect(result.vertices()).toBeInstanceOf(ByteEnvelope);
			}
			expect(new ByteGraphEnvelope('nope' as any, 'nope' as any).edgeCount()).toBe(0);
		});

		it('copies edges and edge records', () => {
			const edges = [edge(0, 1)];
			const result = new ByteGraphEnvelope(ByteEnvelope.encode([1, 2], encodeItem), edges);
			edges[0].to = 0;
			edges.push(edge(1, 0));
			result.edges()[0].from = 1;

			expect(result.edges()).toEqual([edge(0, 1)]);
		});
	});

	describe('toBytes', () => {
		it('writes header, embedded vertex envelope, and edge records', () => {
			const vertices = ByteEnvelope.encode([7, 8], encodeItem);
			const bytes = new ByteGraphEnvelope(vertices, [edge(0, 1, 2.5), edge(1, 1, 0, true)]).toBytes();
			const vertexBytes = vertices.toBytes();
			const data = view(bytes);

			expect(Array.from(bytes.slice(0, 4))).toEqual([0x54, 0x41, 0x44, 0x47]);
			expect(bytes[4]).toBe(ByteGraphEnvelope.Version);
			expect(data.getUint32(5, true)).toBe(vertexBytes.length);
			expect(bytes.slice(9, 9 + vertexBytes.length)).toEqual(vertexBytes);

			const countOffset = 9 + vertexBytes.length;
			expect(data.getUint32(countOffset, true)).toBe(2);

			const first = countOffset + 4;
			expect(data.getUint32(first, true)).toBe(0);
			expect(data.getUint32(first + 4, true)).toBe(1);
			expect(data.getFloat64(first + 8, true)).toBe(2.5);
			expect(bytes[first + 16]).toBe(0);

			const second = first + ByteGraphEnvelope.EdgeSize;
			expect(data.getUint32(second, true)).toBe(1);
			expect(data.getUint32(second + 4, true)).toBe(1);
			expect(data.getFloat64(second + 8, true)).toBe(0);
			expect(bytes[second + 16]).toBe(ByteGraphEnvelope.FlagBidirectional);
			expect(bytes.length).toBe(second + ByteGraphEnvelope.EdgeSize);
		});

		it('empty graph is header, empty envelope, and zero edge count', () => {
			const bytes = new ByteGraphEnvelope().toBytes();

			expect(bytes.length).toBe(ByteGraphEnvelope.HeaderSize + ByteEnvelope.HeaderSize + 4);
			expect(view(bytes).getUint32(bytes.length - 4, true)).toBe(0);
		});
	});

	describe('fromBytes', () => {
		it('round trips byte for byte', () => {
			const bytes = make(3, [edge(0, 1, 0.1), edge(2, 0, 3, true), edge(1, 1, 7), edge(1, 2, -0)]);
			const result = ByteGraphEnvelope.fromBytes(bytes) as ByteGraphEnvelope;

			expect(result).toBeInstanceOf(ByteGraphEnvelope);
			expect(result.vertices().items()).toEqual([
				new Uint8Array([0]),
				new Uint8Array([1]),
				new Uint8Array([2])
			]);
			expect(result.edges()).toEqual([
				edge(0, 1, 0.1),
				edge(2, 0, 3, true),
				edge(1, 1, 7),
				edge(1, 2, -0)
			]);
			expect(Object.is(result.edges()[3].weight, -0)).toBe(true);
			expect(result.toBytes()).toEqual(bytes);
		});

		it('round trips an empty graph', () => {
			const result = ByteGraphEnvelope.fromBytes(new ByteGraphEnvelope().toBytes());

			expect(result?.size()).toBe(0);
			expect(result?.edgeCount()).toBe(0);
		});

		it('reads from a view into a larger buffer', () => {
			const inner = make(2, [edge(0, 1, 4)]);
			const outer = new Uint8Array(inner.length + 8);
			outer.set(inner, 4);

			expect(ByteGraphEnvelope.fromBytes(outer.subarray(4, 4 + inner.length))?.edges()).toEqual([
				edge(0, 1, 4)
			]);
		});

		it('returned vertex items do not alias the source bytes', () => {
			const bytes = make(1, []);
			const result = ByteGraphEnvelope.fromBytes(bytes) as ByteGraphEnvelope;
			bytes.fill(0);

			expect(result.vertices().items()).toEqual([new Uint8Array([0])]);
		});

		it('rejects non byte input and truncated headers', () => {
			expect(ByteGraphEnvelope.fromBytes(null as any)).toBeNull();
			expect(ByteGraphEnvelope.fromBytes('TADG' as any)).toBeNull();
			expect(ByteGraphEnvelope.fromBytes(Array.from(make(0, [])) as any)).toBeNull();
			expect(ByteGraphEnvelope.fromBytes(new Uint8Array(0))).toBeNull();
			expect(
				ByteGraphEnvelope.fromBytes(make(0, []).slice(0, ByteGraphEnvelope.HeaderSize - 1))
			).toBeNull();
		});

		it('rejects wrong magic, including a plain ByteEnvelope', () => {
			const bytes = make(1, []);
			bytes[3] = 0x54;

			expect(ByteGraphEnvelope.fromBytes(bytes)).toBeNull();
			expect(ByteGraphEnvelope.fromBytes(ByteEnvelope.encode([1], encodeItem).toBytes())).toBeNull();
		});

		it('is rejected by ByteEnvelope.fromBytes', () => {
			expect(ByteEnvelope.fromBytes(make(1, []))).toBeNull();
		});

		it('rejects wrong version', () => {
			const bytes = make(1, []);
			bytes[4] = ByteGraphEnvelope.Version + 1;

			expect(ByteGraphEnvelope.fromBytes(bytes)).toBeNull();
		});

		it('rejects a vertex envelope length that runs past the end', () => {
			const bytes = make(2, [edge(0, 1)]);
			view(bytes).setUint32(5, bytes.length, true);

			expect(ByteGraphEnvelope.fromBytes(bytes)).toBeNull();
		});

		it('rejects a missing edge count', () => {
			const bytes = make(1, []);

			expect(ByteGraphEnvelope.fromBytes(bytes.slice(0, bytes.length - 1))).toBeNull();
		});

		it('rejects a malformed vertex envelope', () => {
			const bytes = make(2, []);
			// Vertex envelope magic.
			bytes[ByteGraphEnvelope.HeaderSize] = 0;

			expect(ByteGraphEnvelope.fromBytes(bytes)).toBeNull();
		});

		it('rejects vertex items that reach into the edge section', () => {
			const bytes = make(2, [edge(0, 1)]);
			// Length of the second vertex item, relative to the embedded envelope.
			const entry = ByteGraphEnvelope.HeaderSize + ByteEnvelope.HeaderSize + ByteEnvelope.EntrySize + 4;
			view(bytes).setUint32(entry, 5, true);

			expect(ByteGraphEnvelope.fromBytes(bytes)).toBeNull();
		});

		it('rejects an edge count that does not match the edge section', () => {
			const bytes = make(2, [edge(0, 1)]);
			const countOffset = recordAt(bytes, 0) - 4;

			view(bytes).setUint32(countOffset, 2, true);
			expect(ByteGraphEnvelope.fromBytes(bytes)).toBeNull();

			view(bytes).setUint32(countOffset, 0, true);
			expect(ByteGraphEnvelope.fromBytes(bytes)).toBeNull();

			view(bytes).setUint32(countOffset, 0xffffffff, true);
			expect(ByteGraphEnvelope.fromBytes(bytes)).toBeNull();
		});

		it('rejects a truncated edge record or trailing bytes', () => {
			const bytes = make(2, [edge(0, 1)]);
			const longer = new Uint8Array(bytes.length + 1);
			longer.set(bytes);

			expect(ByteGraphEnvelope.fromBytes(bytes.slice(0, bytes.length - 1))).toBeNull();
			expect(ByteGraphEnvelope.fromBytes(longer)).toBeNull();
		});

		it('rejects out of range vertex indexes', () => {
			for (const field of [0, 4]) {
				const bytes = make(2, [edge(0, 1)]);
				view(bytes).setUint32(recordAt(bytes, 0) + field, 2, true);

				expect(ByteGraphEnvelope.fromBytes(bytes)).toBeNull();
			}

			expect(ByteGraphEnvelope.fromBytes(make(0, [edge(0, 0)]))).toBeNull();
		});

		it('rejects invalid weights', () => {
			for (const weight of [-1, -Number.MIN_VALUE, NaN, Infinity, -Infinity]) {
				const bytes = make(2, [edge(0, 1)]);
				view(bytes).setFloat64(recordAt(bytes, 0) + 8, weight, true);

				expect(ByteGraphEnvelope.fromBytes(bytes)).toBeNull();
			}
		});

		it('rejects unknown flag bits', () => {
			for (const flags of [2, 3, 0x80, 0xff]) {
				const bytes = make(2, [edge(0, 1)]);
				bytes[recordAt(bytes, 0) + 16] = flags;

				expect(ByteGraphEnvelope.fromBytes(bytes)).toBeNull();
			}
		});

		it('rejects a direction covered by two edges', () => {
			const duplicates: ByteGraphEnvelopeEdge[][] = [
				[edge(0, 1), edge(0, 1, 2)],
				[edge(0, 1), edge(1, 0, 1, true)],
				[edge(0, 1, 1, true), edge(1, 0)],
				[edge(0, 1, 1, true), edge(0, 1, 1, true)],
				[edge(0, 1, 1, true), edge(1, 0, 1, true)],
				[edge(1, 1), edge(1, 1, 1, true)],
				[edge(1, 1, 1, true), edge(1, 1, 1, true)]
			];

			for (const edges of duplicates) {
				expect(ByteGraphEnvelope.fromBytes(make(2, edges))).toBeNull();
			}
		});

		it('accepts opposite one-way edges and loops', () => {
			const edges = [edge(0, 1), edge(1, 0), edge(0, 0), edge(1, 1, 1, true)];

			expect(ByteGraphEnvelope.fromBytes(make(2, edges))?.edges()).toEqual(edges);
		});
	});
});
