import {type GraphVertex} from './vertex.js';

/**
 * Base contract for the edges of every graph data structure. An edge joins two
 * vertices and carries a weight, the cost of traveling it. Graphs without
 * weights give every edge a weight of 1.
 *
 * @category Graph
 */
export interface GraphEdge<ItemT> {
	/** Vertex the edge starts at, or null for an unlinked edge. */
	from(): GraphVertex<ItemT> | null;
	/** Vertex the edge ends at, or null for an unlinked edge. */
	to(): GraphVertex<ItemT> | null;
	/** Cost of traveling the edge. */
	weight(): number;
	/** True when the edge can also be traveled from `to()` back to `from()`. */
	isBidirectional(): boolean;
}
