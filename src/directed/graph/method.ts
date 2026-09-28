import type {DirectedGraph} from '../graph';
import type {DirectedGraphVertex} from './vertex';

/**
 * Callback signature for DirectedGraph `forEach` and `filter`. Mirrors the
 * `Map` / `Set` callbacks: the third argument is the graph being walked, not
 * an array. Index counts vertices in insertion order from 0.
 *
 * @typeParam ItemT		Item type held by the graph.
 * @typeParam U			Callback return type.
 *
 * @category Directed Graph
 */
export type DirectedGraphMethod<ItemT, U> = (
	vertex: DirectedGraphVertex<ItemT>,
	index: number,
	graph: DirectedGraph<ItemT>
) => U;
