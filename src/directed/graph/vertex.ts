import type {DirectedGraph} from '../graph';
import type {DirectedGraphEdge} from './edge';
import {type GraphVertex} from '../../graph/vertex';
import {type ObjectPoolInstance} from '../../object/pool/instance';

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
	 * Id of the last `breadthFirst` / `depthFirst` walk that reached this
	 * vertex, or 0. Scratch state managed by `DirectedGraph` only: a vertex is
	 * visited in the current walk exactly when this equals the walk's id, so
	 * walks need no visited set.
	 */
	public _walkId: number = 0;
	/**
	 * Id of the last `findPath` search that reached this vertex, or 0. The
	 * other `_search*` fields are only meaningful while this equals the id of
	 * the running search. Scratch state managed by `DirectedGraph` only.
	 */
	public _searchId: number = 0;
	/** Cheapest known cost from the search start. Scratch, see `_searchId`. */
	public _searchCost: number = 0;
	/** Cached heuristic estimate to the search goal. Scratch, see `_searchId`. */
	public _searchEstimate: number = 0;
	/** Edge the cheapest known path arrived over. Scratch, see `_searchId`. */
	public _searchVia: DirectedGraphEdge<T> | null = null;

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
	 * so a recycled vertex never carries a previous item or its edges. Any new
	 * field added to this class must be cleared here.
	 *
	 * The edge maps are emptied, not replaced. An empty map is left untouched,
	 * so recycling a vertex whose edges were already removed (as
	 * `DirectedGraph.removeVertex()` does) allocates nothing. Clearing a map
	 * that still holds edges lets the engine allocate a fresh backing table
	 * (V8 does), which only happens when a whole graph is cleared at once.
	 */
	public cleanObj(): void {
		this._value = null;
		if (this._out.size > 0) {
			this._out.clear();
		}
		if (this._in.size > 0) {
			this._in.clear();
		}
		this._graph = null;
		this._linkId = 0;
		this._walkId = 0;
		this._searchId = 0;
		this._searchCost = 0;
		this._searchEstimate = 0;
		this._searchVia = null;
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

	/**
	 * Vertices reachable from this one over one edge, in edge insertion order.
	 * @param out	Array to fill instead of allocating a new one. It is
	 * 				overwritten by index and then cut to the result count, so
	 * 				its storage is reused while the count stays the same. V8
	 * 				frees an array's storage when its length drops to 0 and
	 * 				trims it when the length shrinks, so a larger count after a
	 * 				smaller one still allocates. On a hot path use
	 * 				`DirectedGraph.forEachNeighbor()`, which allocates nothing.
	 * @returns		out when provided, otherwise a new array.
	 */
	public neighbors(out?: DirectedGraphVertex<T>[] | null): DirectedGraphVertex<T>[] {
		return fillFrom(this._out, out, writeKey);
	}

	/**
	 * Edges that can be traveled away from this vertex, in edge insertion
	 * order.
	 * @param out	Array to fill instead of allocating a new one, reused as
	 * 				for `neighbors()`. On a hot path use
	 * 				`DirectedGraph.forEachNeighbor()`, which passes each edge
	 * 				and allocates nothing.
	 */
	public outEdges(out?: DirectedGraphEdge<T>[] | null): DirectedGraphEdge<T>[] {
		return fillFrom(this._out, out, writeValue);
	}

	/**
	 * Edges that can be traveled into this vertex, in edge insertion order.
	 * @param out	Array to fill instead of allocating a new one, reused as
	 * 				for `neighbors()`. There is no non-allocating walk of
	 * 				incoming edges; `DirectedGraph.forEachNeighbor()` covers
	 * 				outgoing edges only.
	 */
	public inEdges(out?: DirectedGraphEdge<T>[] | null): DirectedGraphEdge<T>[] {
		return fillFrom(this._in, out, writeValue);
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

const NO_TARGET: unknown[] = [];

/**
 * Write position shared by `writeKey` / `writeValue`. Filling never calls
 * caller code, so one module-level cursor is safe and allocates nothing.
 */
const cursor = {target: NO_TARGET, index: 0};

/**
 * Fill out (or a new array) from map's keys or values, overwriting by index
 * and then cutting the array to the map's size. Overwriting keeps out's
 * storage; emptying it first with `length = 0` would free it in V8.
 */
function fillFrom<K, V, U>(
	map: Map<K, V>,
	out: U[] | null | undefined,
	write: (value: V, key: K) => void
): U[] {
	const target: U[] = Array.isArray(out) ? out : [];

	cursor.target = target;
	cursor.index = 0;
	map.forEach(write);

	if (target.length !== cursor.index) {
		target.length = cursor.index;
	}

	cursor.target = NO_TARGET;

	return target;
}

/** `Map.prototype.forEach` callback writing each key at the cursor. */
function writeKey<K, V>(_value: V, key: K): void {
	cursor.target[cursor.index++] = key;
}

/** `Map.prototype.forEach` callback writing each value at the cursor. */
function writeValue<K, V>(value: V, _key: K): void {
	cursor.target[cursor.index++] = value;
}
