import {type DataStructure} from './data/structure.js';
import {type GraphEdge} from './graph/edge.js';
import {type GraphVertex} from './graph/vertex.js';

/**
 * Base contract shared by every graph data structure: a set of vertices, each
 * wrapping one item, joined by weighted edges. How edges are added (one way,
 * both ways, or either) differs per graph, so adding and removing belong to
 * each implementation, not this base.
 *
 * Every method follows edges in their direction of travel: a one-way edge is
 * only followed from its source, while an edge that can be traveled both ways
 * is followed from either end.
 *
 * @typeParam ItemT		Item type held by the graph's vertices.
 * @typeParam VertexT	Vertex type the graph hands out.
 * @typeParam EdgeT		Edge type the graph hands out.
 *
 * @category Graph
 */
export interface Graph<
	ItemT,
	VertexT extends GraphVertex<ItemT> = GraphVertex<ItemT>,
	EdgeT extends GraphEdge<ItemT> = GraphEdge<ItemT>
> extends DataStructure<ItemT> {
	/** Number of vertices in the graph. */
	size(): number;
	/** Number of edges in the graph. An edge traveled both ways counts once. */
	edgeCount(): number;
	/** True when the graph holds no vertices. */
	isEmpty(): boolean;
	/** Every vertex, in the order the implementation documents. */
	vertices(): VertexT[];
	/** Every edge, in the order the implementation documents. */
	edges(): EdgeT[];
	/** Item of every vertex, in the same order as `vertices()`. */
	values(): ItemT[];
	/**
	 * Edge that can be traveled from `from` to `to`.
	 * @returns		The edge, or null when there is none or either vertex is null
	 * 				or not part of this graph.
	 */
	edge(from: VertexT | null, to: VertexT | null): EdgeT | null;
	/** True when an edge can be traveled from `from` to `to`. */
	adjacent(from: VertexT | null, to: VertexT | null): boolean;
	/**
	 * Vertices reachable from vertex over one edge.
	 * @returns		Neighbors, or an empty array when vertex is null or not part
	 * 				of this graph.
	 */
	neighbors(vertex: VertexT | null): VertexT[];
	/**
	 * Vertices in breadth-first order from start: all vertices one edge away,
	 * then two, and so on. With start omitted, walks every vertex, starting a
	 * new walk from each vertex not yet reached.
	 * @returns		Visited vertices, or an empty array when start is null or not
	 * 				part of this graph.
	 */
	breadthFirst(start?: VertexT | null): VertexT[];
	/**
	 * Vertices in depth-first order from start: each vertex before the vertices
	 * reached through it. With start omitted, walks every vertex, starting a new
	 * walk from each vertex not yet reached.
	 * @returns		Visited vertices, or an empty array when start is null or not
	 * 				part of this graph.
	 */
	depthFirst(start?: VertexT | null): VertexT[];
	/**
	 * True when the graph has a cycle: a path that returns to its first vertex
	 * without using any edge twice, following each edge in a direction it can
	 * be traveled.
	 */
	hasCycle(): boolean;
}
