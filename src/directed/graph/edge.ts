import type {DirectedGraph} from '../graph.js';
import type {DirectedGraphVertex} from './vertex.js';
import {type GraphEdge} from '../../graph/edge.js';
import {type ObjectPoolInstance} from '../../object/pool/instance.js';

/**
 * Weighted edge joining two vertices of a `DirectedGraph`. Implements
 * `ObjectPoolInstance` so the graph can recycle edges through an internal
 * `ObjectPool`. Endpoints and direction are read-only from outside: only the
 * graph links edges. The weight can be changed at any time.
 *
 * @category Directed Graph
 */
export class DirectedGraphEdge<T> implements GraphEdge<T>, ObjectPoolInstance {
	/** Vertex the edge starts at. Managed by `DirectedGraph` only. */
	public _from: DirectedGraphVertex<T> | null = null;
	/** Vertex the edge ends at. Managed by `DirectedGraph` only. */
	public _to: DirectedGraphVertex<T> | null = null;
	/** Cost of traveling the edge: a finite number of 0 or more. */
	public _weight: number = 1;
	/** Whether the edge can also be traveled from `_to` to `_from`. */
	public _bidirectional: boolean = false;
	/**
	 * Graph this edge is currently linked into, or null when unlinked.
	 * Managed by `DirectedGraph` only; lets it check ownership in O(1).
	 */
	public _graph: DirectedGraph<T> | null = null;

	/**
	 * Reset every field to its blank state. Called by `ObjectPool` on release
	 * so a recycled edge never carries previous endpoints. Any new field added
	 * to this class must be cleared here.
	 */
	public cleanObj(): void {
		this._from = null;
		this._to = null;
		this._weight = 1;
		this._bidirectional = false;
		this._graph = null;
	}

	public from(): DirectedGraphVertex<T> | null {
		return this._from;
	}

	public to(): DirectedGraphVertex<T> | null {
		return this._to;
	}

	/**
	 * Get the edge's weight, or set it when newWeight is provided. A new weight
	 * is only accepted when it is a finite number of 0 or more; anything else
	 * is ignored.
	 * @returns		The weight after the call.
	 */
	public weight(newWeight?: number): number {
		if (Number.isFinite(newWeight) && (newWeight as number) >= 0) {
			this._weight = newWeight as number;
		}

		return this._weight;
	}

	public isBidirectional(): boolean {
		return this._bidirectional;
	}
}
