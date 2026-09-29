import type {ByteDataStructure} from '../data/structure';
import {ByteEnvelope} from '../envelope';
import {ByteGraphEnvelope} from '../envelope/graph';
import type {ByteGraphEnvelopeEdge} from '../envelope/edge';
import {DirectedGraph} from '../../directed/graph';
import type {DirectedGraphMethod} from '../../directed/graph/method';
import type {DirectedGraphOptions} from '../../directed/graph/options';
import type {DirectedGraphVertex} from '../../directed/graph/vertex';
import type {ItemCodec} from '../../item/codec';
import {itemCodecValid} from '../../item/codec/valid';

/**
 * `DirectedGraph` that can always be converted to and from bytes, edges
 * included. The item codec is required at construction, so `toBytes()` and
 * `toByteEnvelope()` never fail for lack of one. Everything else is inherited
 * unchanged.
 *
 * @remarks
 * A graph's structure is more than item order, so `toBytes()` writes a
 * `ByteGraphEnvelope` (vertex items in a standard `ByteEnvelope`, followed by
 * edge records), not a bare `ByteEnvelope`. `toByteEnvelope()` still returns
 * the vertex items alone, as the `ByteDataStructure` contract requires, but
 * those bytes do not include edges. See `_specs/byte-envelope.md`.
 *
 * @category Directed Graph
 */
export class ByteDirectedGraph<ItemT> extends DirectedGraph<ItemT> implements ByteDataStructure<ItemT> {
	public readonly codec: ItemCodec<ItemT>;

	/**
	 * @param codec		Converts single items to and from bytes. Required, since
	 * 					items are generic and the graph cannot encode them itself.
	 * @param data		Items added as vertices in array order, with no edges, as
	 * 					for `DirectedGraph`; or the bytes of a graph envelope
	 * 					produced by `toBytes()`, which rebuild every vertex and
	 * 					edge. Any other input is ignored.
	 * @param options	Optional config, as for `DirectedGraph`.
	 * @throws			When `codec` is missing either function, or when `data`
	 * 					is a byte array that is not a well formed
	 * 					`ByteGraphEnvelope`. Malformed bytes are rejected before
	 * 					the codec decodes any item.
	 */
	constructor(
		codec: ItemCodec<ItemT>,
		data?: ItemT[] | Uint8Array | null,
		options?: DirectedGraphOptions<ItemT> | null
	) {
		super(Array.isArray(data) ? data : null, options);

		if (!itemCodecValid<ItemT>(codec)) {
			throw new Error('ByteDirectedGraph requires an ItemCodec with encode and decode functions');
		}

		this.codec = codec;

		if (data instanceof Uint8Array) {
			this.addFromBytes(data);
		}
	}

	/**
	 * Same as `DirectedGraph.filter()`, but the new graph keeps this graph's
	 * codec as well as its options.
	 */
	public filter(func: DirectedGraphMethod<ItemT, boolean>, thisArg?: unknown): ByteDirectedGraph<ItemT> {
		return this.filterInto(new ByteDirectedGraph<ItemT>(this.codec, null, this.options()), func, thisArg);
	}

	/**
	 * Envelope holding each vertex item's bytes, in vertex insertion order.
	 * Edges are not included; `toBytes()` and `toByteGraphEnvelope()` carry
	 * them.
	 */
	public toByteEnvelope(): ByteEnvelope {
		return ByteEnvelope.encode(this.values(), this.codec.encode);
	}

	/**
	 * Graph envelope: vertex items in insertion order, and one record per edge
	 * in edge insertion order, referring to vertices by insertion index.
	 */
	public toByteGraphEnvelope(): ByteGraphEnvelope {
		const indexes = this.vertexIndexes();
		const records: ByteGraphEnvelopeEdge[] = [];

		for (const edge of this.edges()) {
			records.push({
				from: indexes.get(edge._from as DirectedGraphVertex<ItemT>) as number,
				to: indexes.get(edge._to as DirectedGraphVertex<ItemT>) as number,
				weight: edge._weight,
				bidirectional: edge._bidirectional
			});
		}

		return new ByteGraphEnvelope(this.toByteEnvelope(), records);
	}

	/**
	 * Raw bytes of the whole graph, vertices and edges: the serialized
	 * `toByteGraphEnvelope()`. The constructor accepts these bytes, and
	 * rebuilding from them round-trips byte-for-byte.
	 */
	public toBytes(): Uint8Array {
		return this.toByteGraphEnvelope().toBytes();
	}

	/**
	 * Rebuild vertices and edges from graph envelope bytes. Validation runs
	 * first, so a throw leaves the graph empty and the codec uncalled.
	 */
	private addFromBytes(bytes: Uint8Array): void {
		const envelope = ByteGraphEnvelope.fromBytes(bytes);

		if (envelope === null) {
			throw new Error('byte input is not a valid ByteGraphEnvelope');
		}

		const vertices = this.addVertexArray(envelope.vertices().decode(this.codec.decode));
		const records = envelope.edges();

		for (let i = 0; i < records.length; i++) {
			const record = records[i];
			const from = vertices[record.from];
			const to = vertices[record.to];

			// Validation guarantees both adds succeed: indexes in range, weight
			// valid, and no direction covered twice.
			if (record.bidirectional) {
				this.addBidirectionalEdge(from, to, record.weight);
			} else {
				this.addEdge(from, to, record.weight);
			}
		}
	}
}
