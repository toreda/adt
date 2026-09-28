import type {DirectedGraphVertex} from './vertex';

/**
 * Estimated cost of the cheapest path from vertex to goal, used by
 * DirectedGraph `findPath` to search toward the goal first. It must never
 * overestimate the real cost, or the path found may not be the cheapest. A
 * result that is not a finite number of 0 or more is treated as 0.
 *
 * @category Directed Graph
 */
export type DirectedGraphHeuristic<ItemT> = (
	vertex: DirectedGraphVertex<ItemT>,
	goal: DirectedGraphVertex<ItemT>
) => number;
