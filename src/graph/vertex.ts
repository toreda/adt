import {type Element} from '../element';
import {type GraphEdge} from './edge';

/**
 * Base contract for the vertices of every graph data structure. A vertex wraps
 * one item and exposes its edges so callers can walk the graph from it.
 *
 * @remarks
 * The `out` arrays below are emptied before being filled. Emptying an array
 * (`length = 0`) frees its storage in V8, so refilling it allocates whenever
 * there is a result: passing `out` saves only the array object. On a hot path
 * use the graph's `forEachNeighbor()`, which allocates nothing.
 *
 * @category Graph
 */
export interface GraphVertex<ItemT> extends Element<ItemT> {
	/**
	 * Vertices reachable from this one over one edge. Fills and returns out
	 * when provided (emptied first; still allocates, see remarks), otherwise a
	 * new array. Allocation free alternative: `Graph.forEachNeighbor()`.
	 */
	neighbors(out?: GraphVertex<ItemT>[] | null): GraphVertex<ItemT>[];
	/**
	 * Edges that can be traveled away from this vertex. Fills and returns out
	 * when provided (emptied first; still allocates, see remarks), otherwise a
	 * new array. Allocation free alternative: `Graph.forEachNeighbor()`, which
	 * passes each edge.
	 */
	outEdges(out?: GraphEdge<ItemT>[] | null): GraphEdge<ItemT>[];
	/**
	 * Edges that can be traveled into this vertex. Fills and returns out when
	 * provided (emptied first; still allocates, see remarks), otherwise a new
	 * array. `Graph.forEachNeighbor()` covers outgoing edges only.
	 */
	inEdges(out?: GraphEdge<ItemT>[] | null): GraphEdge<ItemT>[];
}
