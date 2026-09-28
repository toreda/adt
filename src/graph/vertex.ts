import {type Element} from '../element.js';
import {type GraphEdge} from './edge.js';

/**
 * Base contract for the vertices of every graph data structure. A vertex wraps
 * one item and exposes its edges so callers can walk the graph from it.
 *
 * @category Graph
 */
export interface GraphVertex<ItemT> extends Element<ItemT> {
	/** Vertices reachable from this one over one edge. */
	neighbors(): GraphVertex<ItemT>[];
	/** Edges that can be traveled away from this vertex. */
	outEdges(): GraphEdge<ItemT>[];
	/** Edges that can be traveled into this vertex. */
	inEdges(): GraphEdge<ItemT>[];
}
