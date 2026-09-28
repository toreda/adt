import {DirectedGraphEdge} from './graph/edge.js';
import type {DirectedGraphError} from './graph/error.js';
import type {DirectedGraphHeuristic} from './graph/heuristic.js';
import {DirectedGraphIterator} from './graph/iterator.js';
import type {DirectedGraphMethod} from './graph/method.js';
import type {DirectedGraphOptions} from './graph/options.js';
import type {DirectedGraphPath} from './graph/path.js';
import {DirectedGraphVertex} from './graph/vertex.js';
import {ElementPool} from '../element/pool.js';
import type {Graph} from '../graph.js';
import type {ObjectPoolConstructor} from '../object/pool/constructor.js';
import {PriorityQueue} from '../priority/queue.js';
import type {QueryFilter} from '../query/filter.js';
import type {QueryOptions} from '../query/options.js';
import type {QueryResult} from '../query/result.js';
import {isNumber} from '../utility.js';

/** Open set entry for `findPath`. */
interface SearchEntry<ItemT> {
	vertex: DirectedGraphVertex<ItemT>;
	/** Cost of the cheapest known path from start to vertex. */
	cost: number;
	/** cost plus the heuristic estimate from vertex to goal. */
	estimate: number;
	/** Push order, so entries with equal estimates pop first in, first out. */
	order: number;
}

/**
 * Graph of vertices joined by weighted edges. Each edge is either one-way
 * (`addEdge`), traveled only from its source to its target, or bidirectional
 * (`addBidirectionalEdge`), traveled either way. Both kinds can be mixed in
 * one graph, and a graph using only bidirectional edges behaves as an
 * undirected graph.
 *
 * Adjacency is kept per vertex in hash maps, so adding and removing an edge,
 * and checking whether two vertices are adjacent, take O(1). Removing a vertex
 * takes O(d), where d is the number of edges touching it. Traversals, cycle
 * detection, and `stringify()` take O(V + E), and `findPath()` takes
 * O(E log V). Every walk is iterative, so long paths never overflow the call
 * stack.
 *
 * Vertex and edge wrappers are pooled by default (see `DataStructureOptions`),
 * so once the pools have grown, adding vertices and edges allocates nothing.
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
 * @category Directed Graph
 */
export class DirectedGraph<ItemT>
	implements Graph<ItemT, DirectedGraphVertex<ItemT>, DirectedGraphEdge<ItemT>>
{
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

		if (Array.isArray(data)) {
			this.addVertexArray(data);
		}
	}

	/**
	 * Iterate vertex items in insertion order.
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

		return items.map((item) => this.addVertex(item));
	}

	/**
	 * Remove vertex and every edge touching it.
	 * @returns		The removed item, or null when vertex is null or not part of
	 * 				this graph (including a vertex that was already removed).
	 */
	public removeVertex(vertex: DirectedGraphVertex<ItemT> | null): ItemT | null {
		if (!this.isPartOfGraph(vertex)) {
			return null;
		}

		const value = vertex._value as ItemT;
		// Collected first: removing an edge edits the maps being read. A Set,
		// since an edge traveled both ways is listed in both maps.
		const edges = new Set([...vertex._out.values(), ...vertex._in.values()]);

		for (const edge of edges) {
			this.removeEdge(edge);
		}

		this._vertices.delete(vertex);
		this.unlinkVertex(vertex);
		this.vertexPool.release(vertex);

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
	 * Remove edge in O(1). Its vertices stay in the graph. With pooling on, the
	 * edge is recycled and must not be used afterwards.
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
		this.unlinkEdge(edge);
		this.edgePool.release(edge);

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
	 * @returns		Neighbors, or an empty array when vertex is null or not part
	 * 				of this graph.
	 */
	public neighbors(vertex: DirectedGraphVertex<ItemT> | null): DirectedGraphVertex<ItemT>[] {
		return this.isPartOfGraph(vertex) ? vertex.neighbors() : [];
	}

	/**
	 * First vertex, in insertion order, whose item is item. Items are matched
	 * like `Array.prototype.includes`: by identity, with NaN matching NaN.
	 * O(V).
	 * @returns		Matching vertex, or null when no vertex holds item.
	 */
	public find(item: ItemT): DirectedGraphVertex<ItemT> | null {
		for (const vertex of this._vertices) {
			if (vertex._value === item || (item !== item && vertex._value !== vertex._value)) {
				return vertex;
			}
		}

		return null;
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
	 * Every vertex, in insertion order.
	 */
	public vertices(): DirectedGraphVertex<ItemT>[] {
		return Array.from(this._vertices);
	}

	/**
	 * Every edge, in insertion order.
	 */
	public edges(): DirectedGraphEdge<ItemT>[] {
		return Array.from(this._edges);
	}

	/**
	 * Item of every vertex, in insertion order.
	 */
	public values(): ItemT[] {
		const values: ItemT[] = [];

		for (const vertex of this._vertices) {
			values.push(vertex._value as ItemT);
		}

		return values;
	}

	/**
	 * Vertices in breadth-first order from start, in O(V + E): start, then
	 * every vertex one edge away, then two, and so on. Each vertex's neighbors
	 * are visited in edge insertion order. With start omitted, walks every
	 * vertex, starting a new walk from each vertex not yet reached, in
	 * insertion order.
	 * @returns		Visited vertices, or an empty array when start is null or not
	 * 				part of this graph.
	 */
	public breadthFirst(start?: DirectedGraphVertex<ItemT> | null): DirectedGraphVertex<ItemT>[] {
		const visited = new Set<DirectedGraphVertex<ItemT>>();
		const order: DirectedGraphVertex<ItemT>[] = [];

		for (const root of this.walkRoots(start)) {
			if (visited.has(root)) {
				continue;
			}

			visited.add(root);
			const first = order.length;
			order.push(root);

			// order doubles as the queue: everything from first on is this walk.
			for (let i = first; i < order.length; i++) {
				for (const next of order[i]._out.keys()) {
					if (!visited.has(next)) {
						visited.add(next);
						order.push(next);
					}
				}
			}
		}

		return order;
	}

	/**
	 * Vertices in depth-first order from start, in O(V + E): each vertex, then
	 * everything reachable through its first unvisited neighbor, then its next,
	 * and so on, in edge insertion order. The order matches a recursive walk,
	 * but uses an explicit stack. With start omitted, walks every vertex,
	 * starting a new walk from each vertex not yet reached, in insertion order.
	 * @returns		Visited vertices, or an empty array when start is null or not
	 * 				part of this graph.
	 */
	public depthFirst(start?: DirectedGraphVertex<ItemT> | null): DirectedGraphVertex<ItemT>[] {
		const visited = new Set<DirectedGraphVertex<ItemT>>();
		const order: DirectedGraphVertex<ItemT>[] = [];
		const stack: DirectedGraphVertex<ItemT>[] = [];

		for (const root of this.walkRoots(start)) {
			stack.push(root);

			while (stack.length > 0) {
				const vertex = stack.pop() as DirectedGraphVertex<ItemT>;

				if (visited.has(vertex)) {
					continue;
				}

				visited.add(vertex);
				order.push(vertex);

				// Pushed in reverse, so the first neighbor is popped first.
				const neighbors = vertex.neighbors();
				for (let i = neighbors.length - 1; i >= 0; i--) {
					if (!visited.has(neighbors[i])) {
						stack.push(neighbors[i]);
					}
				}
			}
		}

		return order;
	}

	/**
	 * True when the graph has a cycle: a path that returns to its first vertex
	 * without using any edge twice, following each edge in a direction it can
	 * be traveled. Loops count, as do two one-way edges in opposite directions.
	 * A single bidirectional edge does not, since going back over it uses it
	 * twice. Works for any mix of edge kinds and for disconnected graphs, in
	 * O(V + E).
	 *
	 * @remarks
	 * A plain depth-first search gives wrong answers once one-way and
	 * bidirectional edges are mixed. Instead, vertices joined by bidirectional
	 * edges are merged into groups. Those edges form a cycle by themselves
	 * unless every group is a tree. Otherwise there is a cycle exactly when a
	 * one-way edge stays within one group, or the one-way edges between groups
	 * form a directed cycle, found with Kahn's algorithm.
	 */
	public hasCycle(): boolean {
		// Union-find over bidirectional edges. Roots have no entry.
		const parents = new Map<DirectedGraphVertex<ItemT>, DirectedGraphVertex<ItemT>>();
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

			parents.set(rootFrom, rootTo);
		}

		// One-way edges between groups, and how many point into each group.
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

			for (const target of arcs.get(group) ?? []) {
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
	 * Cheapest path from start to goal, found with A* search in O(E log V).
	 * Edges are followed in their direction of travel and cost their weight.
	 *
	 * @param heuristic		Estimated cost from a vertex to goal. It must never
	 * 						overestimate, or the path found may not be the
	 * 						cheapest. Omitted, every estimate is 0 and the search
	 * 						runs as Dijkstra's algorithm.
	 * @returns		The path, a path of just start when start is goal, or null
	 * 				when goal cannot be reached or either vertex is null or not
	 * 				part of this graph.
	 */
	public findPath(
		start: DirectedGraphVertex<ItemT> | null,
		goal: DirectedGraphVertex<ItemT> | null,
		heuristic?: DirectedGraphHeuristic<ItemT> | null
	): DirectedGraphPath<ItemT> | null {
		if (!this.isPartOfGraph(start) || !this.isPartOfGraph(goal)) {
			return null;
		}

		const estimate = (vertex: DirectedGraphVertex<ItemT>): number => {
			if (typeof heuristic !== 'function') {
				return 0;
			}

			const result = heuristic(vertex, goal);
			return Number.isFinite(result) && result > 0 ? result : 0;
		};

		// Cheapest known cost to reach each vertex, and the edge that reached it.
		const costs = new Map<DirectedGraphVertex<ItemT>, number>([[start, 0]]);
		const via = new Map<DirectedGraphVertex<ItemT>, DirectedGraphEdge<ItemT>>();
		const open = new PriorityQueue<SearchEntry<ItemT>>(
			(a, b) => a.estimate < b.estimate || (a.estimate === b.estimate && a.order < b.order)
		);
		let order = 0;

		open.push({vertex: start, cost: 0, estimate: estimate(start), order: order++});

		while (!open.isEmpty()) {
			const entry = open.pop() as SearchEntry<ItemT>;

			// A cheaper path to this vertex was found after this entry was queued.
			if (entry.cost > (costs.get(entry.vertex) as number)) {
				continue;
			}

			if (entry.vertex === goal) {
				return this.buildPath(start, goal, via, entry.cost);
			}

			for (const [next, edge] of entry.vertex._out) {
				const cost = entry.cost + edge._weight;
				const known = costs.get(next);

				if (known === undefined || cost < known) {
					costs.set(next, cost);
					via.set(next, edge);
					open.push({vertex: next, cost, estimate: cost + estimate(next), order: order++});
				}
			}
		}

		return null;
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
		const graph = new DirectedGraph<ItemT>(null, this.options());
		const copies = new Map<DirectedGraphVertex<ItemT>, DirectedGraphVertex<ItemT>>();

		this.forEach((vertex, index, source) => {
			if (func.call(thisArg, vertex, index, source)) {
				copies.set(vertex, graph.addVertex(vertex._value as ItemT));
			}
		});

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
	 * Call func for each vertex in insertion order.
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
		let index = 0;

		for (const vertex of this._vertices) {
			func.call(thisArg, vertex, index, this);
			index++;
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
		const indexes = new Map<DirectedGraphVertex<ItemT>, number>();
		let index = 0;

		for (const vertex of this._vertices) {
			indexes.set(vertex, index++);
		}

		const edges = this.edges().map((edge) => ({
			from: indexes.get(edge._from as DirectedGraphVertex<ItemT>),
			to: indexes.get(edge._to as DirectedGraphVertex<ItemT>),
			weight: edge._weight,
			bidirectional: edge._bidirectional
		}));

		try {
			return JSON.stringify({type: 'DirectedGraph', vertices: this.values(), edges});
		} catch {
			return null;
		}
	}

	/**
	 * Find vertices whose items pass every filter, in insertion order. Each
	 * result's `delete()` removes its vertex along with its edges, and does
	 * nothing once that vertex has been removed some other way.
	 */
	public query(
		filters: QueryFilter<ItemT> | QueryFilter<ItemT>[],
		opts?: QueryOptions
	): QueryResult<DirectedGraphVertex<ItemT>, ItemT>[] {
		const resultsArray: QueryResult<DirectedGraphVertex<ItemT>, ItemT>[] = [];
		const options = this.queryOptions(opts);

		for (const vertex of this._vertices) {
			// Stops walking as soon as the limit is reached.
			if (resultsArray.length >= options.limit) {
				break;
			}

			const value = vertex._value as ItemT;
			const take = Array.isArray(filters)
				? filters.length > 0 && filters.every((filter) => filter(value))
				: filters(value);

			if (!take) {
				continue;
			}

			resultsArray.push({
				element: vertex,
				key: (): string | null => null,
				index: (): number | null => null,
				delete: this.queryDelete.bind(this, vertex, vertex._linkId)
			});
		}

		return resultsArray;
	}

	/**
	 * Unlink and drop every vertex and edge. Wrappers removed this way have
	 * their links cleared, and are recycled when pooling is on.
	 */
	public clearElements(): DirectedGraph<ItemT> {
		const edges = this.edges();
		const vertices = this.vertices();

		for (const edge of edges) {
			this.unlinkEdge(edge);
		}

		for (const vertex of vertices) {
			this.unlinkVertex(vertex);
		}

		this._edges.clear();
		this._vertices.clear();
		this.edgePool.releaseAll(edges);
		this.vertexPool.releaseAll(vertices);

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
	 * Walk the via edges back from goal to start, then reverse them into a
	 * path. An edge traveled both ways may have been crossed from `_to` to
	 * `_from`, so each step takes whichever end is not the current vertex.
	 */
	private buildPath(
		start: DirectedGraphVertex<ItemT>,
		goal: DirectedGraphVertex<ItemT>,
		via: Map<DirectedGraphVertex<ItemT>, DirectedGraphEdge<ItemT>>,
		cost: number
	): DirectedGraphPath<ItemT> {
		const vertices: DirectedGraphVertex<ItemT>[] = [goal];
		const edges: DirectedGraphEdge<ItemT>[] = [];
		let curr = goal;

		while (curr !== start) {
			const edge = via.get(curr) as DirectedGraphEdge<ItemT>;
			curr = (edge._to === curr ? edge._from : edge._to) as DirectedGraphVertex<ItemT>;
			edges.push(edge);
			vertices.push(curr);
		}

		return {vertices: vertices.reverse(), edges: edges.reverse(), cost};
	}

	/**
	 * Vertices each walk starts from: every vertex when start is omitted,
	 * start alone when it is part of this graph, and none otherwise.
	 */
	private walkRoots(start?: DirectedGraphVertex<ItemT> | null): Iterable<DirectedGraphVertex<ItemT>> {
		if (start === undefined) {
			return this._vertices;
		}

		return this.isPartOfGraph(start) ? [start] : [];
	}

	/**
	 * Clear vertex's edges and ownership. Needed even when pooling is off,
	 * where release does not blank the vertex.
	 */
	private unlinkVertex(vertex: DirectedGraphVertex<ItemT>): void {
		vertex._out.clear();
		vertex._in.clear();
		vertex._graph = null;
		vertex._linkId = 0;
	}

	/**
	 * Clear edge's endpoints and ownership. Needed even when pooling is off,
	 * where release does not blank the edge. The weight and direction are kept
	 * until the edge is recycled.
	 */
	private unlinkEdge(edge: DirectedGraphEdge<ItemT>): void {
		edge._from = null;
		edge._to = null;
		edge._graph = null;
	}

	private isPartOfGraph(vertex: DirectedGraphVertex<ItemT> | null | undefined): vertex is DirectedGraphVertex<ItemT> {
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

	private queryOptions(opts?: QueryOptions): Required<QueryOptions> {
		const options: Required<QueryOptions> = {
			limit: Infinity
		};

		if (opts?.limit && isNumber(opts.limit) && opts.limit >= 1) {
			options.limit = Math.round(opts.limit);
		}

		return options;
	}
}
