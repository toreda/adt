import {DirectedGraphEdge} from './graph/edge';
import type {DirectedGraphError} from './graph/error';
import type {DirectedGraphHeuristic} from './graph/heuristic';
import {DirectedGraphIterator} from './graph/iterator';
import type {DirectedGraphMethod} from './graph/method';
import type {DirectedGraphOptions} from './graph/options';
import type {DirectedGraphPath} from './graph/path';
import {DirectedGraphSearch} from './graph/search';
import {DirectedGraphVertex} from './graph/vertex';
import {ElementPool} from '../element/pool';
import type {Graph} from '../graph';
import type {GraphNeighborMethod} from '../graph/neighbor/method';
import type {ObjectPoolConstructor} from '../object/pool/constructor';
import type {QueryFilter} from '../query/filter';
import type {QueryOptions} from '../query/options';
import type {QueryResult} from '../query/result';
import {isNumber} from '../utility';

/**
 * Scratch state for `breadthFirst` / `depthFirst`, reused by every walk of
 * one graph. Walks call no caller code, so one instance per graph is enough.
 */
interface WalkState<ItemT> {
	/** Id of the running walk. A vertex is visited when its `_walkId` matches. */
	id: number;
	/** Output of the running walk. Doubles as the breadth-first queue. */
	order: DirectedGraphVertex<ItemT>[];
	/**
	 * Depth-first stack, used up to `stackTop`. Slots are overwritten and
	 * nulled rather than pushed and popped, because V8 trims an array's
	 * storage as it shrinks, so capacity is kept across walks.
	 */
	readonly stack: (DirectedGraphVertex<ItemT> | null)[];
	stackTop: number;
	/** Depth-first neighbor buffer, used up to `scratchCount`, capacity kept. */
	readonly scratch: (DirectedGraphVertex<ItemT> | null)[];
	scratchCount: number;
}

/** Placeholder output for a walk that is not running. Never written to. */
const noVertices: never[] = [];

/**
 * Graph of vertices joined by weighted edges. Each edge is either one-way
 * (`addEdge`), traveled only from its source to its target, or bidirectional
 * (`addBidirectionalEdge`), traveled either way. Both kinds can be mixed in
 * one graph, and a graph using only bidirectional edges behaves as an
 * undirected graph.
 *
 * Adjacency is kept per vertex in hash maps, so adding and removing an edge,
 * and checking whether two vertices are adjacent, take O(1). Removing a vertex
 * takes O(d), where d is the number of edges touching it. Traversals and
 * `stringify()` take O(V + E), cycle detection takes O((V + E) α(V)) (α is
 * the inverse Ackermann function, below 5 for any real graph), and
 * `findPath()` takes O(E log V) without a heuristic or with a consistent one.
 * Every walk is iterative, so long paths never
 * overflow the call stack.
 *
 * Vertex and edge wrappers are pooled by default (see `DataStructureOptions`),
 * so once the pools have grown, adding and removing vertices and edges creates
 * no new wrappers. `forEach`, `forEachNeighbor`, `find`, and `edge` allocate
 * nothing in steady state. `neighbors`, `outEdges`, `inEdges`, and
 * `findPath` accept an output array or path to reuse. They overwrite it by
 * index and cut it to the result count, so its storage is reused while the
 * count stays the same; V8 trims an array's storage when its length shrinks,
 * so a larger count after a smaller one still allocates. Use
 * `forEachNeighbor` on a hot path.
 *
 * @remarks
 * A graph does not compare or order its items: vertices are handles, and one
 * item may be added as several vertices. Methods take and return vertex
 * handles; `find()` locates the first vertex holding an item in O(V).
 *
 * At most one edge leads from one vertex to another. Adding an edge that could
 * be traveled in a direction an existing edge already covers adds nothing and
 * returns the `edge_exists` error code instead of throwing. Weights must be
 * finite numbers of 0 or more, since `findPath()` relies on that.
 *
 * Adjacency lives in JavaScript `Map` and `Set` objects. Their backing tables
 * belong to the engine, which may resize them as edges come and go (V8 grows
 * and shrinks them, and replaces them on `clear()`); that storage is not
 * pooled.
 *
 * @category Directed Graph
 */
export class DirectedGraph<ItemT> implements Graph<
	ItemT,
	DirectedGraphVertex<ItemT>,
	DirectedGraphEdge<ItemT>
> {
	/** Every linked vertex, in insertion order. */
	private readonly _vertices: Set<DirectedGraphVertex<ItemT>>;
	/** Every linked edge, in insertion order. */
	private readonly _edges: Set<DirectedGraphEdge<ItemT>>;
	/** Last id handed to a linked vertex. Only increases, so ids never repeat. */
	private lastLinkId: number;
	/** Source of vertex wrappers, pooled or freshly allocated per options. */
	private readonly vertexPool: ElementPool<DirectedGraphVertex<ItemT>>;
	/** Source of edge wrappers, pooled or freshly allocated per options. */
	private readonly edgePool: ElementPool<DirectedGraphEdge<ItemT>>;
	/** Traversal scratch state, see `WalkState`. */
	private readonly walk: WalkState<ItemT>;
	/** `findPath` state, created by the first search. */
	private search: DirectedGraphSearch<ItemT> | null;

	/**
	 * Callbacks handed to `Set` / `Map` `forEach` by the methods below, created
	 * once per graph so walks allocate no closure per call. Each reads its
	 * arguments from the matching fields, which the calling method saves and
	 * restores around the walk so nested calls stay correct.
	 */
	private readonly visitVertex: (vertex: DirectedGraphVertex<ItemT>) => void;
	private eachFunc: DirectedGraphMethod<ItemT, void> | null;
	private eachThis: unknown;
	private eachIndex: number;

	private readonly visitNeighbor: (
		edge: DirectedGraphEdge<ItemT>,
		neighbor: DirectedGraphVertex<ItemT>
	) => void;
	private neighborFunc: GraphNeighborMethod<DirectedGraphVertex<ItemT>, DirectedGraphEdge<ItemT>> | null;
	private neighborThis: unknown;

	private readonly matchVertex: (vertex: DirectedGraphVertex<ItemT>) => void;
	private matchItem: ItemT | null;
	private matchResult: DirectedGraphVertex<ItemT> | null;

	/**
	 * @param data			Items added as vertices in array order on creation, with
	 * 						no edges. Any other input is ignored.
	 * @param options		Optional config. Each option falls back to its default
	 * 						when missing or invalid.
	 */
	constructor(data?: ItemT[] | null, options?: DirectedGraphOptions<ItemT> | null) {
		this._vertices = new Set();
		this._edges = new Set();
		this.lastLinkId = 0;
		// Both wrapper classes are generic and the pools build blank wrappers,
		// so any ItemT instantiation is valid here.
		this.vertexPool = new ElementPool(
			DirectedGraphVertex as ObjectPoolConstructor<DirectedGraphVertex<ItemT>>,
			options
		);
		this.edgePool = new ElementPool(
			DirectedGraphEdge as ObjectPoolConstructor<DirectedGraphEdge<ItemT>>,
			options
		);
		this.walk = {id: 0, order: noVertices, stack: [], stackTop: 0, scratch: [], scratchCount: 0};
		this.search = null;

		this.eachFunc = null;
		this.eachThis = undefined;
		this.eachIndex = 0;
		this.visitVertex = (vertex): void => {
			const index = this.eachIndex++;
			(this.eachFunc as DirectedGraphMethod<ItemT, void>).call(this.eachThis, vertex, index, this);
		};

		this.neighborFunc = null;
		this.neighborThis = undefined;
		this.visitNeighbor = (edge, neighbor): void => {
			(
				this.neighborFunc as GraphNeighborMethod<DirectedGraphVertex<ItemT>, DirectedGraphEdge<ItemT>>
			).call(this.neighborThis, neighbor, edge);
		};

		this.matchItem = null;
		this.matchResult = null;
		this.matchVertex = (vertex): void => {
			if (this.matchResult !== null) {
				return;
			}

			const item = this.matchItem;
			if (vertex._value === item || (item !== item && vertex._value !== vertex._value)) {
				this.matchResult = vertex;
			}
		};

		if (Array.isArray(data)) {
			this.addVertexArray(data);
		}
	}

	/**
	 * Iterate vertex items in insertion order. Creates an iterator per loop;
	 * `forEach()` is the non-allocating alternative.
	 */
	[Symbol.iterator](): DirectedGraphIterator<ItemT> {
		return new DirectedGraphIterator<ItemT>(this._vertices.values());
	}

	/**
	 * Add item as a new vertex with no edges.
	 * @returns		The vertex now holding item.
	 */
	public addVertex(item: ItemT): DirectedGraphVertex<ItemT> {
		const vertex = this.vertexPool.allocate();
		vertex._value = item;
		vertex._graph = this;
		vertex._linkId = ++this.lastLinkId;
		this._vertices.add(vertex);

		return vertex;
	}

	/**
	 * Add each provided item as a new vertex, in array order.
	 * @returns		The new vertices, in the same order. Empty when items is not
	 * 				an array.
	 */
	public addVertexArray(items?: ItemT[] | null): DirectedGraphVertex<ItemT>[] {
		if (!Array.isArray(items)) {
			return [];
		}

		const vertices: DirectedGraphVertex<ItemT>[] = [];
		for (let i = 0; i < items.length; i++) {
			vertices.push(this.addVertex(items[i]));
		}

		return vertices;
	}

	/**
	 * Remove vertex and every edge touching it, in O(d) for d such edges. The
	 * vertex is blanked (item, edges, and ownership cleared) and, with pooling
	 * on, recycled; it must not be used afterwards. Creates no arrays, sets, or
	 * iterators.
	 * @returns		The removed item, or null when vertex is null or not part of
	 * 				this graph (including a vertex that was already removed).
	 */
	public removeVertex(vertex: DirectedGraphVertex<ItemT> | null): ItemT | null {
		if (!this.isPartOfGraph(vertex)) {
			return null;
		}

		const value = vertex._value as ItemT;
		// Deleting entries during Map.forEach is safe: deleted entries are not
		// visited. An edge traveled both ways is listed in both maps and is gone
		// from _in by the time that map is walked.
		vertex._out.forEach(this.removeEdge, this);
		vertex._in.forEach(this.removeEdge, this);

		this._vertices.delete(vertex);
		this.dropVertex(vertex);

		return value;
	}

	/**
	 * Add a one-way edge, traveled only from `from` to `to`. `from` and `to`
	 * may be the same vertex, which adds a loop.
	 * @param weight	Cost of traveling the edge. Defaults to 1 when omitted.
	 * @returns		The new edge, or an error code when nothing was added:
	 * 				`vertex_not_in_graph` when either vertex is null or not part
	 * 				of this graph, `edge_exists` when an edge can already be
	 * 				traveled from `from` to `to`, `invalid_weight` when weight is
	 * 				not a finite number of 0 or more.
	 */
	public addEdge(
		from: DirectedGraphVertex<ItemT> | null,
		to: DirectedGraphVertex<ItemT> | null,
		weight?: number
	): DirectedGraphEdge<ItemT> | DirectedGraphError {
		if (!this.isPartOfGraph(from) || !this.isPartOfGraph(to)) {
			return 'vertex_not_in_graph';
		}

		if (from._out.has(to)) {
			return 'edge_exists';
		}

		return this.linkEdge(from, to, weight, false);
	}

	/**
	 * Add an edge traveled both ways between `a` and `b`, at the same weight in
	 * each direction. It counts as one edge: `from()` is `a` and `to()` is `b`.
	 * @param weight	Cost of traveling the edge. Defaults to 1 when omitted.
	 * @returns		The new edge, or an error code when nothing was added:
	 * 				`vertex_not_in_graph` when either vertex is null or not part
	 * 				of this graph, `edge_exists` when an edge can already be
	 * 				traveled between them in either direction, `invalid_weight`
	 * 				when weight is not a finite number of 0 or more.
	 */
	public addBidirectionalEdge(
		a: DirectedGraphVertex<ItemT> | null,
		b: DirectedGraphVertex<ItemT> | null,
		weight?: number
	): DirectedGraphEdge<ItemT> | DirectedGraphError {
		if (!this.isPartOfGraph(a) || !this.isPartOfGraph(b)) {
			return 'vertex_not_in_graph';
		}

		if (a._out.has(b) || b._out.has(a)) {
			return 'edge_exists';
		}

		return this.linkEdge(a, b, weight, true);
	}

	/**
	 * Remove edge in O(1). Its vertices stay in the graph. The edge's endpoints
	 * and ownership are cleared. With pooling on, the edge is also recycled
	 * and must not be used afterwards; with pooling off it keeps its weight and
	 * direction.
	 * @returns		True when removed, false when edge is null or not part of
	 * 				this graph (including an edge that was already removed).
	 */
	public removeEdge(edge: DirectedGraphEdge<ItemT> | null): boolean {
		if (!edge || edge._graph !== this) {
			return false;
		}

		const from = edge._from as DirectedGraphVertex<ItemT>;
		const to = edge._to as DirectedGraphVertex<ItemT>;

		from._out.delete(to);
		to._in.delete(from);

		if (edge._bidirectional) {
			to._out.delete(from);
			from._in.delete(to);
		}

		this._edges.delete(edge);
		this.dropEdge(edge);

		return true;
	}

	/**
	 * Edge that can be traveled from `from` to `to`, found in O(1). For an
	 * edge traveled both ways, either order finds it.
	 * @returns		The edge, or null when there is none or either vertex is null
	 * 				or not part of this graph.
	 */
	public edge(
		from: DirectedGraphVertex<ItemT> | null,
		to: DirectedGraphVertex<ItemT> | null
	): DirectedGraphEdge<ItemT> | null {
		if (!this.isPartOfGraph(from) || !this.isPartOfGraph(to)) {
			return null;
		}

		const edge = from._out.get(to);

		return edge ? edge : null;
	}

	/**
	 * True when an edge can be traveled from `from` to `to`, in O(1).
	 */
	public adjacent(from: DirectedGraphVertex<ItemT> | null, to: DirectedGraphVertex<ItemT> | null): boolean {
		return this.edge(from, to) !== null;
	}

	/**
	 * Vertices reachable from vertex over one edge, in edge insertion order.
	 * @param out	Array to fill instead of allocating a new one. It is
	 * 				overwritten by index and cut to the result count (emptied
	 * 				when vertex is not part of this graph), so its storage is
	 * 				reused while the count stays the same. V8 frees an array's
	 * 				storage when its length drops to 0 and trims it when the
	 * 				length shrinks, so a larger count after a smaller one still
	 * 				allocates. On a hot path use `forEachNeighbor()`, which
	 * 				allocates nothing.
	 * @returns		out when provided, otherwise a new array. Empty when vertex
	 * 				is null or not part of this graph.
	 */
	public neighbors(
		vertex: DirectedGraphVertex<ItemT> | null,
		out?: DirectedGraphVertex<ItemT>[] | null
	): DirectedGraphVertex<ItemT>[] {
		if (this.isPartOfGraph(vertex)) {
			return vertex.neighbors(out);
		}

		if (Array.isArray(out)) {
			out.length = 0;
			return out;
		}

		return [];
	}

	/**
	 * Call func with (neighbor, edge) once for each edge that can be traveled
	 * away from vertex, in edge insertion order. Allocates nothing: the
	 * non-allocating way to visit neighbors, e.g. for per-frame AI queries.
	 * Does nothing when vertex is null or not part of this graph.
	 *
	 * @remarks
	 * func may remove edges of vertex, which are then not visited if not yet
	 * reached. Edges added to vertex during the walk are visited. func must
	 * not remove vertex itself.
	 *
	 * @param thisArg	Value used as `this` when calling func, as passed. Like
	 * 					`Array.prototype.forEach`, `this` is undefined when omitted.
	 */
	public forEachNeighbor(
		vertex: DirectedGraphVertex<ItemT> | null,
		func: GraphNeighborMethod<DirectedGraphVertex<ItemT>, DirectedGraphEdge<ItemT>>,
		thisArg?: unknown
	): DirectedGraph<ItemT> {
		if (!this.isPartOfGraph(vertex)) {
			return this;
		}

		const prevFunc = this.neighborFunc;
		const prevThis = this.neighborThis;
		this.neighborFunc = func;
		this.neighborThis = thisArg;

		try {
			vertex._out.forEach(this.visitNeighbor);
		} finally {
			this.neighborFunc = prevFunc;
			this.neighborThis = prevThis;
		}

		return this;
	}

	/**
	 * First vertex, in insertion order, whose item is item. Items are matched
	 * like `Array.prototype.includes`: by identity, with NaN matching NaN.
	 * O(V), and allocates nothing.
	 * @returns		Matching vertex, or null when no vertex holds item.
	 */
	public find(item: ItemT): DirectedGraphVertex<ItemT> | null {
		// Set.forEach cannot stop early, but visitors after the match return
		// at once, and it needs no iterator.
		this.matchItem = item;
		this.matchResult = null;
		this._vertices.forEach(this.matchVertex);

		const result = this.matchResult;
		this.matchItem = null;
		this.matchResult = null;

		return result;
	}

	/**
	 * Check whether any vertex holds item, matched as in `find()`.
	 */
	public contains(item: ItemT): boolean {
		return this.find(item) !== null;
	}

	/**
	 * Get number of vertices in the graph.
	 * @returns		Vertex count as a positive integer, or 0 if empty.
	 */
	public size(): number {
		return this._vertices.size;
	}

	/**
	 * Get number of edges in the graph. An edge traveled both ways counts once.
	 */
	public edgeCount(): number {
		return this._edges.size;
	}

	/**
	 * Quickly check whether the graph has vertices.
	 */
	public isEmpty(): boolean {
		return this._vertices.size === 0;
	}

	/**
	 * Every vertex, in insertion order, as a new array.
	 */
	public vertices(): DirectedGraphVertex<ItemT>[] {
		return Array.from(this._vertices);
	}

	/**
	 * Every edge, in insertion order, as a new array.
	 */
	public edges(): DirectedGraphEdge<ItemT>[] {
		return Array.from(this._edges);
	}

	/**
	 * Item of every vertex, in insertion order, as a new array.
	 */
	public values(): ItemT[] {
		const values: ItemT[] = [];
		this._vertices.forEach(pushVertexValue, values);

		return values;
	}

	/**
	 * Vertices in breadth-first order from start, in O(V + E): start, then
	 * every vertex one edge away, then two, and so on. Each vertex's neighbors
	 * are visited in edge insertion order. With start omitted, walks every
	 * vertex, starting a new walk from each vertex not yet reached, in
	 * insertion order. Allocates only the returned array: visited vertices are
	 * marked in place.
	 * @returns		Visited vertices, or an empty array when start is null or not
	 * 				part of this graph.
	 */
	public breadthFirst(start?: DirectedGraphVertex<ItemT> | null): DirectedGraphVertex<ItemT>[] {
		return this.runWalk(start, breadthFromRoot);
	}

	/**
	 * Vertices in depth-first order from start, in O(V + E): each vertex, then
	 * everything reachable through its first unvisited neighbor, then its next,
	 * and so on, in edge insertion order. The order matches a recursive walk,
	 * but uses an explicit stack. With start omitted, walks every vertex,
	 * starting a new walk from each vertex not yet reached, in insertion order.
	 * Allocates only the returned array once the graph's reused stack has
	 * grown: visited vertices are marked in place.
	 * @returns		Visited vertices, or an empty array when start is null or not
	 * 				part of this graph.
	 */
	public depthFirst(start?: DirectedGraphVertex<ItemT> | null): DirectedGraphVertex<ItemT>[] {
		return this.runWalk(start, depthFromRoot);
	}

	/**
	 * True when the graph has a cycle: a path that returns to its first vertex
	 * without using any edge twice, following each edge in a direction it can
	 * be traveled. Loops count, as do two one-way edges in opposite directions.
	 * A single bidirectional edge does not, since going back over it uses it
	 * twice. Works for any mix of edge kinds and for disconnected graphs, in
	 * O((V + E) α(V)), effectively O(V + E).
	 *
	 * @remarks
	 * A plain depth-first search gives wrong answers once one-way and
	 * bidirectional edges are mixed. Instead, vertices joined by bidirectional
	 * edges are merged into groups with union-find (union by size and path
	 * compression). Those edges form a cycle by themselves unless every group
	 * is a tree. Otherwise there is a cycle exactly when a one-way edge stays
	 * within one group, or the one-way edges between groups form a directed
	 * cycle, found with Kahn's algorithm.
	 */
	public hasCycle(): boolean {
		// Union-find over bidirectional edges. Roots have no parent entry, and
		// groups of one vertex have no size entry.
		const parents = new Map<DirectedGraphVertex<ItemT>, DirectedGraphVertex<ItemT>>();
		const sizes = new Map<DirectedGraphVertex<ItemT>, number>();
		const findRoot = (vertex: DirectedGraphVertex<ItemT>): DirectedGraphVertex<ItemT> => {
			let root = vertex;
			let parent = parents.get(root);

			while (parent) {
				root = parent;
				parent = parents.get(root);
			}

			// Point every vertex on the way straight at the root.
			let curr = vertex;
			while (curr !== root) {
				const next = parents.get(curr) as DirectedGraphVertex<ItemT>;
				parents.set(curr, root);
				curr = next;
			}

			return root;
		};

		for (const edge of this._edges) {
			if (!edge._bidirectional) {
				continue;
			}

			const rootFrom = findRoot(edge._from as DirectedGraphVertex<ItemT>);
			const rootTo = findRoot(edge._to as DirectedGraphVertex<ItemT>);

			// Already joined another way, or a loop.
			if (rootFrom === rootTo) {
				return true;
			}

			// Union by size keeps every tree O(log V) deep before compression.
			const sizeFrom = sizes.get(rootFrom) ?? 1;
			const sizeTo = sizes.get(rootTo) ?? 1;

			if (sizeFrom < sizeTo) {
				parents.set(rootFrom, rootTo);
				sizes.set(rootTo, sizeFrom + sizeTo);
				sizes.delete(rootFrom);
			} else {
				parents.set(rootTo, rootFrom);
				sizes.set(rootFrom, sizeFrom + sizeTo);
				sizes.delete(rootTo);
			}
		}

		// One-way edges between groups, and how many point into each group.
		// Only groups with outgoing arcs get a target list.
		const arcs = new Map<DirectedGraphVertex<ItemT>, DirectedGraphVertex<ItemT>[]>();
		const incoming = new Map<DirectedGraphVertex<ItemT>, number>();

		for (const edge of this._edges) {
			if (edge._bidirectional) {
				continue;
			}

			const rootFrom = findRoot(edge._from as DirectedGraphVertex<ItemT>);
			const rootTo = findRoot(edge._to as DirectedGraphVertex<ItemT>);

			// Returns within the group over bidirectional edges, or a loop.
			if (rootFrom === rootTo) {
				return true;
			}

			const targets = arcs.get(rootFrom);
			if (targets) {
				targets.push(rootTo);
			} else {
				arcs.set(rootFrom, [rootTo]);
			}

			if (!incoming.has(rootFrom)) {
				incoming.set(rootFrom, 0);
			}
			incoming.set(rootTo, (incoming.get(rootTo) ?? 0) + 1);
		}

		// Kahn's algorithm: repeatedly drop groups nothing points into. Groups
		// left over lie on or behind a directed cycle.
		const ready: DirectedGraphVertex<ItemT>[] = [];
		for (const [group, count] of incoming) {
			if (count === 0) {
				ready.push(group);
			}
		}

		let dropped = 0;
		while (ready.length > 0) {
			const group = ready.pop() as DirectedGraphVertex<ItemT>;
			dropped++;

			const targets = arcs.get(group);
			if (targets === undefined) {
				continue;
			}

			for (let i = 0; i < targets.length; i++) {
				const target = targets[i];
				const count = (incoming.get(target) as number) - 1;
				incoming.set(target, count);

				if (count === 0) {
					ready.push(target);
				}
			}
		}

		return dropped < incoming.size;
	}

	/**
	 * Cheapest path from start to goal, found with A* search. Takes O(E log V)
	 * without a heuristic, or with one that is consistent (for every edge u -> v,
	 * the estimate at u is at most the edge weight plus the estimate at v). A
	 * heuristic that never overestimates but is not consistent still finds the
	 * cheapest path, but may expand vertices more than once.
	 * Edges are followed in their direction of travel and cost their weight.
	 *
	 * The graph keeps its search state (open set, pooled queue entries, and
	 * per-vertex scratch fields) between calls, so once it has grown to the
	 * largest search so far, a search allocates only the returned path. With
	 * `out`, it allocates nothing unless out's arrays must grow (see `out`). The
	 * heuristic runs at most once per vertex per search.
	 *
	 * @param heuristic		Estimated cost from a vertex to goal. It must never
	 * 						overestimate, or the path found may not be the
	 * 						cheapest. Omitted, every estimate is 0 and the search
	 * 						runs as Dijkstra's algorithm. It must not change the
	 * 						graph. A `findPath` call on the same graph from inside
	 * 						the heuristic returns null.
	 * @param out			Path to fill instead of allocating one: its arrays are
	 * 						overwritten by index and cut to the path length, and
	 * 						its cost set. Left unchanged when null is returned. V8
	 * 						trims an array's storage when its length shrinks, so
	 * 						a longer path after a shorter one grows the arrays
	 * 						again; a path no longer than the previous one reuses
	 * 						their storage.
	 * @returns		The path (out, when provided), a path of just start when start
	 * 				is goal, or null when goal cannot be reached or either vertex
	 * 				is null or not part of this graph.
	 */
	public findPath(
		start: DirectedGraphVertex<ItemT> | null,
		goal: DirectedGraphVertex<ItemT> | null,
		heuristic?: DirectedGraphHeuristic<ItemT> | null,
		out?: DirectedGraphPath<ItemT> | null
	): DirectedGraphPath<ItemT> | null {
		if (!this.isPartOfGraph(start) || !this.isPartOfGraph(goal)) {
			return null;
		}

		if (this.search === null) {
			this.search = new DirectedGraphSearch<ItemT>();
		}

		return this.search.run(start, goal, heuristic, out);
	}

	/**
	 * Create a new graph holding the vertices for which func returns true, and
	 * every edge between two of them, with the same weights and directions.
	 * The new graph uses this graph's options. O(V + E).
	 * @param func		Called with (vertex, index, graph) in insertion order.
	 * @param thisArg	Value used as `this` when calling func, as passed. Like
	 * 					`Array.prototype.filter`, `this` is undefined when omitted.
	 */
	public filter(func: DirectedGraphMethod<ItemT, boolean>, thisArg?: unknown): DirectedGraph<ItemT> {
		return this.filterInto(new DirectedGraph<ItemT>(null, this.options()), func, thisArg);
	}

	/**
	 * Fill graph, which must be empty, as `filter()` describes. Lets subclasses
	 * return their own type from `filter()`.
	 */
	protected filterInto<GraphT extends DirectedGraph<ItemT>>(
		graph: GraphT,
		func: DirectedGraphMethod<ItemT, boolean>,
		thisArg?: unknown
	): GraphT {
		const copies = new Map<DirectedGraphVertex<ItemT>, DirectedGraphVertex<ItemT>>();
		let index = 0;

		for (const vertex of this._vertices) {
			if (func.call(thisArg, vertex, index, this)) {
				copies.set(vertex, graph.addVertex(vertex._value as ItemT));
			}
			index++;
		}

		for (const edge of this._edges) {
			const from = copies.get(edge._from as DirectedGraphVertex<ItemT>);
			const to = copies.get(edge._to as DirectedGraphVertex<ItemT>);

			if (from && to) {
				graph.linkEdge(from, to, edge._weight, edge._bidirectional);
			}
		}

		return graph;
	}

	/**
	 * Options equivalent to the ones this graph was built with, for creating
	 * derived graphs that behave the same way.
	 */
	protected options(): DirectedGraphOptions<ItemT> {
		return this.vertexPool.options();
	}

	/**
	 * Call func for each vertex in insertion order. Allocates nothing: the
	 * non-allocating way to visit every vertex (iteration creates an iterator
	 * per loop).
	 *
	 * @remarks
	 * Like `Map` / `Set`, func receives the graph itself as its third argument,
	 * not an array. func may remove the current vertex. Vertices added during
	 * the walk are visited.
	 *
	 * @param func		Called with (vertex, index, graph) in insertion order.
	 * @param thisArg	Value used as `this` when calling func, as passed. Like
	 * 					`Array.prototype.forEach`, `this` is undefined when omitted.
	 */
	public forEach(func: DirectedGraphMethod<ItemT, void>, thisArg?: unknown): DirectedGraph<ItemT> {
		const prevFunc = this.eachFunc;
		const prevThis = this.eachThis;
		const prevIndex = this.eachIndex;
		this.eachFunc = func;
		this.eachThis = thisArg;
		this.eachIndex = 0;

		try {
			this._vertices.forEach(this.visitVertex);
		} finally {
			this.eachFunc = prevFunc;
			this.eachThis = prevThis;
			this.eachIndex = prevIndex;
		}

		return this;
	}

	/**
	 * Serialize the graph to a JSON string. Vertex items are listed in
	 * insertion order, and each edge refers to its vertices by their index in
	 * that list: `{"from": 0, "to": 1, "weight": 1, "bidirectional": false}`.
	 * @returns		JSON string, or null when an item cannot be serialized
	 * 				(e.g. items contain circular references or BigInt values).
	 */
	public stringify(): string | null {
		const indexes = this.vertexIndexes();
		const edges: {from: number; to: number; weight: number; bidirectional: boolean}[] = [];

		for (const edge of this._edges) {
			edges.push({
				from: indexes.get(edge._from as DirectedGraphVertex<ItemT>) as number,
				to: indexes.get(edge._to as DirectedGraphVertex<ItemT>) as number,
				weight: edge._weight,
				bidirectional: edge._bidirectional
			});
		}

		try {
			return JSON.stringify({type: 'DirectedGraph', vertices: this.values(), edges});
		} catch {
			return null;
		}
	}

	/**
	 * Find vertices whose items pass every filter, in insertion order. Each
	 * result's `delete()` removes its vertex along with its edges, and does
	 * nothing once that vertex has been removed some other way. Allocates the
	 * result array and one result object per match; filters are checked
	 * without per-vertex closures. An empty filter array matches nothing.
	 */
	public query(
		filters: QueryFilter<ItemT> | QueryFilter<ItemT>[],
		opts?: QueryOptions
	): QueryResult<DirectedGraphVertex<ItemT>, ItemT>[] {
		const resultsArray: QueryResult<DirectedGraphVertex<ItemT>, ItemT>[] = [];
		const limit = queryLimit(opts);

		for (const vertex of this._vertices) {
			// Stops walking as soon as the limit is reached.
			if (resultsArray.length >= limit) {
				break;
			}

			if (!queryMatch(filters, vertex._value as ItemT)) {
				continue;
			}

			resultsArray.push({
				element: vertex,
				key: returnNull,
				index: returnNull,
				delete: this.queryDelete.bind(this, vertex, vertex._linkId)
			});
		}

		return resultsArray;
	}

	/**
	 * Unlink and drop every vertex and edge, in O(V + E). Each wrapper is
	 * blanked as it is dropped (links, ownership, and vertex items cleared),
	 * and recycled when pooling is on. Walks the graph's own sets without
	 * copying them.
	 */
	public clearElements(): DirectedGraph<ItemT> {
		// Methods passed with thisArg: no closure or iterator per call.
		this._edges.forEach(this.dropEdge, this);
		this._vertices.forEach(this.dropVertex, this);
		this._edges.clear();
		this._vertices.clear();

		return this;
	}

	/**
	 * Restore the graph to its freshly constructed state. Constructor options
	 * are kept.
	 */
	public reset(): DirectedGraph<ItemT> {
		this.clearElements();

		return this;
	}

	/**
	 * Index of every vertex in insertion order, as written by `stringify()`
	 * and byte forms of the graph.
	 */
	protected vertexIndexes(): Map<DirectedGraphVertex<ItemT>, number> {
		const indexes = new Map<DirectedGraphVertex<ItemT>, number>();
		let index = 0;

		for (const vertex of this._vertices) {
			indexes.set(vertex, index++);
		}

		return indexes;
	}

	/**
	 * Link a new edge between two vertices of this graph, once the caller has
	 * checked that no existing edge covers its directions.
	 */
	private linkEdge(
		from: DirectedGraphVertex<ItemT>,
		to: DirectedGraphVertex<ItemT>,
		weight: number | undefined,
		bidirectional: boolean
	): DirectedGraphEdge<ItemT> | DirectedGraphError {
		const value = weight === undefined ? 1 : weight;

		if (!Number.isFinite(value) || value < 0) {
			return 'invalid_weight';
		}

		const edge = this.edgePool.allocate();
		edge._from = from;
		edge._to = to;
		edge._weight = value;
		edge._bidirectional = bidirectional;
		edge._graph = this;

		from._out.set(to, edge);
		to._in.set(from, edge);

		if (bidirectional) {
			to._out.set(from, edge);
			from._in.set(to, edge);
		}

		this._edges.add(edge);

		return edge;
	}

	/**
	 * Run a breadth-first or depth-first walk from start, or from every vertex
	 * when start is omitted, with a fresh walk id so earlier marks count as
	 * unvisited.
	 */
	private runWalk(
		start: DirectedGraphVertex<ItemT> | null | undefined,
		fromRoot: (this: WalkState<ItemT>, root: DirectedGraphVertex<ItemT>) => void
	): DirectedGraphVertex<ItemT>[] {
		const order: DirectedGraphVertex<ItemT>[] = [];

		if (start !== undefined && !this.isPartOfGraph(start)) {
			return order;
		}

		const walk = this.walk;
		walk.id++;
		walk.order = order;

		if (start === undefined) {
			this._vertices.forEach(fromRoot, walk);
		} else {
			fromRoot.call(walk, start);
		}

		walk.order = noVertices;

		return order;
	}

	/**
	 * Drop a vertex that is no longer linked. With pooling on, release blanks
	 * it via `cleanObj()` and recycles it. With pooling off it is blanked here,
	 * so it keeps no item or edges alive. Blanking a vertex whose maps are
	 * already empty allocates nothing.
	 */
	private dropVertex(vertex: DirectedGraphVertex<ItemT>): void {
		if (this.vertexPool.enabled()) {
			this.vertexPool.release(vertex);
		} else {
			vertex.cleanObj();
		}
	}

	/**
	 * Drop an edge that is no longer linked. With pooling on, release blanks
	 * it via `cleanObj()` and recycles it. With pooling off only its endpoints
	 * and ownership are cleared; the weight and direction stay readable.
	 */
	private dropEdge(edge: DirectedGraphEdge<ItemT>): void {
		if (this.edgePool.enabled()) {
			this.edgePool.release(edge);
		} else {
			edge._from = null;
			edge._to = null;
			edge._graph = null;
		}
	}

	private isPartOfGraph(
		vertex: DirectedGraphVertex<ItemT> | null | undefined
	): vertex is DirectedGraphVertex<ItemT> {
		return !!vertex && vertex._graph === this;
	}

	/**
	 * Remove a query match, but only while vertex still holds the item it
	 * matched. A recycled vertex reissued to a later add carries a new link
	 * id, so a stale result deletes nothing instead of the new item.
	 */
	private queryDelete(vertex: DirectedGraphVertex<ItemT>, linkId: number): ItemT | null {
		if (vertex._linkId !== linkId) {
			return null;
		}

		return this.removeVertex(vertex);
	}
}

/** Shared `key` / `index` for query results, which have neither. */
function returnNull(): null {
	return null;
}

/** Numeric query limit: a number of 1 or more, rounded, else no limit. */
function queryLimit(opts?: QueryOptions): number {
	const limit = opts?.limit;

	if (limit && isNumber(limit) && limit >= 1) {
		return Math.round(limit);
	}

	return Infinity;
}

/**
 * True when value passes filters: the single filter, or every filter of a
 * non-empty array. A plain loop, so no closure is created per vertex.
 */
function queryMatch<ItemT>(filters: QueryFilter<ItemT> | QueryFilter<ItemT>[], value: ItemT): boolean {
	if (!Array.isArray(filters)) {
		return filters(value);
	}

	if (filters.length === 0) {
		return false;
	}

	for (let i = 0; i < filters.length; i++) {
		if (!filters[i](value)) {
			return false;
		}
	}

	return true;
}

/** `Set.forEach` callback appending each vertex's item to the array passed as `this`. */
function pushVertexValue<ItemT>(this: ItemT[], vertex: DirectedGraphVertex<ItemT>): void {
	this.push(vertex._value as ItemT);
}

/**
 * `Map.forEach` callback for `breadthFromRoot`: queue each unvisited
 * neighbor, with the walk state as `this`.
 */
function visitBreadth<ItemT>(
	this: WalkState<ItemT>,
	_edge: DirectedGraphEdge<ItemT>,
	next: DirectedGraphVertex<ItemT>
): void {
	if (next._walkId !== this.id) {
		next._walkId = this.id;
		this.order.push(next);
	}
}

/** Breadth-first walk from root, appending to the walk's order. */
function breadthFromRoot<ItemT>(this: WalkState<ItemT>, root: DirectedGraphVertex<ItemT>): void {
	if (root._walkId === this.id) {
		return;
	}

	root._walkId = this.id;
	const order = this.order;
	const first = order.length;
	order.push(root);

	// order doubles as the queue: everything from first on is this walk.
	for (let i = first; i < order.length; i++) {
		order[i]._out.forEach(visitBreadth, this);
	}
}

/** `Map.forEach` callback writing each neighbor into the walk's scratch buffer. */
function writeNeighbor<ItemT>(
	this: WalkState<ItemT>,
	_edge: DirectedGraphEdge<ItemT>,
	next: DirectedGraphVertex<ItemT>
): void {
	this.scratch[this.scratchCount++] = next;
}

/** Depth-first walk from root, appending to the walk's order. */
function depthFromRoot<ItemT>(this: WalkState<ItemT>, root: DirectedGraphVertex<ItemT>): void {
	const stack = this.stack;
	const scratch = this.scratch;
	stack[this.stackTop++] = root;

	while (this.stackTop > 0) {
		const vertex = stack[--this.stackTop] as DirectedGraphVertex<ItemT>;
		stack[this.stackTop] = null;

		if (vertex._walkId === this.id) {
			continue;
		}

		vertex._walkId = this.id;
		this.order.push(vertex);

		// Pushed in reverse, so the first neighbor is popped first.
		this.scratchCount = 0;
		vertex._out.forEach(writeNeighbor, this);
		for (let i = this.scratchCount - 1; i >= 0; i--) {
			const next = scratch[i] as DirectedGraphVertex<ItemT>;
			scratch[i] = null;

			if (next._walkId !== this.id) {
				stack[this.stackTop++] = next;
			}
		}
		this.scratchCount = 0;
	}
}
