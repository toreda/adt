/**
 * Callback signature for `Graph.forEachNeighbor`: called once per edge that
 * can be traveled away from the walked vertex, with the vertex it leads to.
 *
 * @typeParam VertexT	Vertex type the graph hands out.
 * @typeParam EdgeT		Edge type the graph hands out.
 *
 * @category Graph
 */
export type GraphNeighborMethod<VertexT, EdgeT> = (neighbor: VertexT, edge: EdgeT) => void;
