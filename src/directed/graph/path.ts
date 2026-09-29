import type {DirectedGraphEdge} from './edge';
import type {DirectedGraphVertex} from './vertex';

/**
 * Path returned by DirectedGraph `findPath`. Pass one back as its `out`
 * argument to have the next search refill it instead of allocating a new one.
 *
 * @category Directed Graph
 */
export interface DirectedGraphPath<ItemT> {
	/** Vertices from start to goal, both included. */
	vertices: DirectedGraphVertex<ItemT>[];
	/** Edges traveled, in order. Always one fewer than `vertices`. */
	edges: DirectedGraphEdge<ItemT>[];
	/** Sum of the weights of `edges`. */
	cost: number;
}
