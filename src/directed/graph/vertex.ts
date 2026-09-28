import type {DirectedGraph} from '../graph.js';
import type {DirectedGraphEdge} from './edge.js';
import {type GraphVertex} from '../../graph/vertex.js';
import {type ObjectPoolInstance} from '../../object/pool/instance.js';

/**
 * Vertex wrapping one item in a `DirectedGraph`. Implements
 * `ObjectPoolInstance` so the graph can recycle vertices through an internal
 * `ObjectPool`. Edges are read-only from outside: only the graph links and
 * unlinks them, so both ends of every edge always agree.
 *
 * @category Directed Graph
 */
export class DirectedGraphVertex<T> implements GraphVertex<T>, ObjectPoolInstance {
	/**
	 * Item held by this vertex. Managed by `DirectedGraph`; a linked vertex
	 * holds exactly the item it was added with, including null or undefined
	 * items, until changed with `value()`.
	 */
	public _value: T | null = null;
	/**
	 * Edges that can be traveled away from this vertex, keyed by the vertex
	 * each one leads to. Managed by `DirectedGraph` only. An edge traveled both
	 * ways is listed here at both of its ends.
	 */
	public readonly _out: Map<DirectedGraphVertex<T>, DirectedGraphEdge<T>> = new Map();
	/**
	 * Edges that can be traveled into this vertex, keyed by the vertex each one
	 * comes from. Managed by `DirectedGraph` only.
	 */
	public readonly _in: Map<DirectedGraphVertex<T>, DirectedGraphEdge<T>> = new Map();
	/**
	 * Graph this vertex is currently linked into, or null when unlinked.
	 * Managed by `DirectedGraph` only; lets it check ownership in O(1).
	 */
	public _graph: DirectedGraph<T> | null = null;
	/**
	 * Id of the add that linked this vertex, unique within `_graph`, or 0 when
	 * unlinked. Managed by `DirectedGraph` only. A recycled vertex gets a new
	 * id, so a handle that captured the old one can tell it was reissued.
	 */
	public _linkId: number = 0;

	/**
	 * @param element	Initial value. Omitted when constructed by an `ObjectPool`,
	 * 					which hands out blank vertices for the graph to fill.
	 */
	constructor(element?: T) {
		if (element !== undefined) {
			this._value = element;
		}
	}

	/**
	 * Reset every field to its blank state. Called by `ObjectPool` on release
	 * so a recycled vertex never carries a previous item or its edges. The edge
	 * maps are emptied, not replaced, so recycling allocates nothing. Any new
	 * field added to this class must be cleared here.
	 */
	public cleanObj(): void {
		this._value = null;
		this._out.clear();
		this._in.clear();
		this._graph = null;
		this._linkId = 0;
	}

	/**
	 * Get the vertex's value, or set it when elementValue is provided. A graph
	 * does not order its items, so any value is accepted.
	 */
	public value(elementValue?: T): T | null {
		if (typeof elementValue === 'undefined') {
			return this._value;
		}

		this._value = elementValue;

		return null;
	}

	/** Vertices reachable from this one over one edge, in edge insertion order. */
	public neighbors(): DirectedGraphVertex<T>[] {
		return Array.from(this._out.keys());
	}

	/** Edges that can be traveled away from this vertex. */
	public outEdges(): DirectedGraphEdge<T>[] {
		return Array.from(this._out.values());
	}

	/** Edges that can be traveled into this vertex. */
	public inEdges(): DirectedGraphEdge<T>[] {
		return Array.from(this._in.values());
	}

	/** Number of edges that can be traveled away from this vertex. */
	public outDegree(): number {
		return this._out.size;
	}

	/** Number of edges that can be traveled into this vertex. */
	public inDegree(): number {
		return this._in.size;
	}
}
