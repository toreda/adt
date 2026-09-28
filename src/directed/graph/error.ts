/**
 * Codes returned in place of an edge by DirectedGraph methods that refuse to
 * add it instead of throwing.
 *
 * - `vertex_not_in_graph`: an endpoint is null or not part of this graph.
 * - `edge_exists`: an edge can already be traveled in a direction the new edge
 *   would add.
 * - `invalid_weight`: the weight is not a finite number of 0 or more.
 *
 * @category Directed Graph
 */
export type DirectedGraphError = 'vertex_not_in_graph' | 'edge_exists' | 'invalid_weight';
