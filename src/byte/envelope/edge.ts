/**
 * One edge record of a `ByteGraphEnvelope`. Vertices are referred to by their
 * index in the envelope's vertex items, which are in vertex insertion order.
 *
 * @category Base
 */
export interface ByteGraphEnvelopeEdge {
	/** Index of the vertex the edge starts at. */
	from: number;
	/** Index of the vertex the edge ends at. */
	to: number;
	/** Cost of traveling the edge: a finite number of 0 or more. */
	weight: number;
	/** True when the edge can also be traveled from `to` back to `from`. */
	bidirectional: boolean;
}
