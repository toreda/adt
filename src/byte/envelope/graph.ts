import {ByteEnvelope} from '../envelope';
import {type ByteGraphEnvelopeEdge} from './edge';

/**
 * Byte container for a graph: a standard `ByteEnvelope` holding each vertex's
 * item bytes in vertex order, followed by a section of fixed-size edge
 * records that refer to vertices by index. The vertex envelope is embedded
 * unchanged (version 1), so every other data structure keeps reading and
 * writing plain `ByteEnvelope` bytes, and graph bytes are told apart by their
 * own magic.
 *
 * Layout, all integers little-endian:
 * ```
 * 0          u8[4]  magic "TADG"
 * 4          u8     graph format version
 * 5          u32    vertex envelope length (L)
 * 9          u8[L]  vertex envelope: a complete ByteEnvelope ("TADT")
 * 9 + L      u32    edge count (m)
 * 13 + L     m x {u32 from, u32 to, f64 weight, u8 flags}   edge records
 * ```
 * Flags bit 0 marks a bidirectional edge; every other bit must be 0.
 *
 * Full specification: `_specs/byte-envelope.md`.
 *
 * @category Base
 */
export class ByteGraphEnvelope {
	/** ASCII "TADG". */
	public static readonly Magic: readonly number[] = [0x54, 0x41, 0x44, 0x47];
	public static readonly Version = 1;
	/** Bytes before the vertex envelope: magic, version, envelope length. */
	public static readonly HeaderSize = 9;
	/** Bytes of the edge count that follows the vertex envelope. */
	public static readonly EdgeCountSize = 4;
	/** Bytes per edge record: from, to, weight, flags. */
	public static readonly EdgeSize = 17;
	/** Flags bit marking a bidirectional edge. */
	public static readonly FlagBidirectional = 1;

	private readonly _vertices: ByteEnvelope;
	private readonly _edges: ByteGraphEnvelopeEdge[];

	/**
	 * @param vertices	Vertex item bytes, in vertex order. Anything other than a
	 * 					`ByteEnvelope` produces a graph without vertices.
	 * @param edges		Edge records, in edge order. The array and each record
	 * 					are copied. Non-array input produces no edges. Records
	 * 					are not validated here; `fromBytes` rejects bytes whose
	 * 					records break the rules in the specification.
	 */
	constructor(vertices?: ByteEnvelope | null, edges?: ByteGraphEnvelopeEdge[] | null) {
		this._vertices = vertices instanceof ByteEnvelope ? vertices : new ByteEnvelope();
		this._edges = [];

		if (Array.isArray(edges)) {
			for (let i = 0; i < edges.length; i++) {
				this._edges.push(copyEdge(edges[i]));
			}
		}
	}

	/**
	 * Parse and validate graph envelope bytes. Every check runs before any
	 * item decoder can, so a caller's decoder only ever sees a graph whose
	 * edges can all be rebuilt.
	 * @returns		Envelope, or null when bytes are not a well formed graph
	 * 				envelope: wrong magic or version, truncated sections, a
	 * 				malformed vertex envelope, an edge section whose size does
	 * 				not match its count, or an edge with an out of range vertex
	 * 				index, an invalid weight, unknown flags, or a direction
	 * 				another edge already covers.
	 */
	public static fromBytes(bytes: Uint8Array): ByteGraphEnvelope | null {
		const header = ByteGraphEnvelope.HeaderSize;

		if (!(bytes instanceof Uint8Array) || bytes.length < header) {
			return null;
		}

		for (let i = 0; i < ByteGraphEnvelope.Magic.length; i++) {
			if (bytes[i] !== ByteGraphEnvelope.Magic[i]) {
				return null;
			}
		}

		if (bytes[4] !== ByteGraphEnvelope.Version) {
			return null;
		}

		const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
		const envelopeLength = view.getUint32(5, true);
		const countOffset = header + envelopeLength;

		if (countOffset + ByteGraphEnvelope.EdgeCountSize > bytes.length) {
			return null;
		}

		// Parsed from a view bounded to its own length, so no vertex entry can
		// reach into the edge section.
		const vertices = ByteEnvelope.fromBytes(bytes.subarray(header, countOffset));

		if (vertices === null) {
			return null;
		}

		const edgeCount = view.getUint32(countOffset, true);
		const edgesStart = countOffset + ByteGraphEnvelope.EdgeCountSize;

		if (edgesStart + edgeCount * ByteGraphEnvelope.EdgeSize !== bytes.length) {
			return null;
		}

		const vertexCount = vertices.size();
		const covered = new DirectionSet(vertexCount);
		const edges: ByteGraphEnvelopeEdge[] = [];

		for (let i = 0; i < edgeCount; i++) {
			const record = edgesStart + i * ByteGraphEnvelope.EdgeSize;
			const from = view.getUint32(record, true);
			const to = view.getUint32(record + 4, true);
			const weight = view.getFloat64(record + 8, true);
			const flags = view.getUint8(record + 16);

			if (from >= vertexCount || to >= vertexCount) {
				return null;
			}

			if (!Number.isFinite(weight) || weight < 0) {
				return null;
			}

			if ((flags & ~ByteGraphEnvelope.FlagBidirectional) !== 0) {
				return null;
			}

			const bidirectional = flags === ByteGraphEnvelope.FlagBidirectional;

			// The same rule the graph applies when adding: at most one edge
			// per direction of travel.
			if (covered.has(from, to) || (bidirectional && covered.has(to, from))) {
				return null;
			}

			covered.add(from, to);
			if (bidirectional) {
				covered.add(to, from);
			}

			edges.push({from, to, weight, bidirectional});
		}

		const envelope = new ByteGraphEnvelope(vertices);
		// Records built above are owned by nothing else, so no copy is needed.
		for (let i = 0; i < edges.length; i++) {
			envelope._edges.push(edges[i]);
		}

		return envelope;
	}

	/**
	 * Vertex item bytes, in vertex order.
	 */
	public vertices(): ByteEnvelope {
		return this._vertices;
	}

	/**
	 * Copy of every edge record, in edge order.
	 */
	public edges(): ByteGraphEnvelopeEdge[] {
		const edges: ByteGraphEnvelopeEdge[] = [];

		for (let i = 0; i < this._edges.length; i++) {
			edges.push(copyEdge(this._edges[i]));
		}

		return edges;
	}

	/** Number of vertices. */
	public size(): number {
		return this._vertices.size();
	}

	/** Number of edge records. */
	public edgeCount(): number {
		return this._edges.length;
	}

	/**
	 * Serialize to bytes in the documented layout.
	 */
	public toBytes(): Uint8Array {
		const vertexBytes = this._vertices.toBytes();
		const header = ByteGraphEnvelope.HeaderSize;
		const countOffset = header + vertexBytes.length;
		const edgesStart = countOffset + ByteGraphEnvelope.EdgeCountSize;
		const count = this._edges.length;

		const bytes = new Uint8Array(edgesStart + count * ByteGraphEnvelope.EdgeSize);
		const view = new DataView(bytes.buffer);

		bytes.set(ByteGraphEnvelope.Magic, 0);
		bytes[4] = ByteGraphEnvelope.Version;
		view.setUint32(5, vertexBytes.length, true);
		bytes.set(vertexBytes, header);
		view.setUint32(countOffset, count, true);

		for (let i = 0; i < count; i++) {
			const edge = this._edges[i];
			const record = edgesStart + i * ByteGraphEnvelope.EdgeSize;

			view.setUint32(record, edge.from, true);
			view.setUint32(record + 4, edge.to, true);
			view.setFloat64(record + 8, edge.weight, true);
			view.setUint8(record + 16, edge.bidirectional ? ByteGraphEnvelope.FlagBidirectional : 0);
		}

		return bytes;
	}
}

function copyEdge(edge: ByteGraphEnvelopeEdge): ByteGraphEnvelopeEdge {
	return {
		from: edge.from,
		to: edge.to,
		weight: edge.weight,
		bidirectional: edge.bidirectional === true
	};
}

/**
 * Set of (from, to) vertex index pairs, for rejecting duplicate directions.
 * Pairs are packed into one number while that stays exact, and into a string
 * for graphs too large for that.
 */
class DirectionSet {
	private readonly vertexCount: number;
	private readonly packed: boolean;
	private readonly keys: Set<number | string>;

	constructor(vertexCount: number) {
		this.vertexCount = vertexCount;
		this.packed = vertexCount * vertexCount <= Number.MAX_SAFE_INTEGER;
		this.keys = new Set();
	}

	public has(from: number, to: number): boolean {
		return this.keys.has(this.key(from, to));
	}

	public add(from: number, to: number): void {
		this.keys.add(this.key(from, to));
	}

	private key(from: number, to: number): number | string {
		return this.packed ? from * this.vertexCount + to : `${from}:${to}`;
	}
}
