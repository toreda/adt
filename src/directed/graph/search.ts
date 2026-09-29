import type {DirectedGraphEdge} from './edge';
import type {DirectedGraphHeuristic} from './heuristic';
import type {DirectedGraphPath} from './path';
import type {DirectedGraphVertex} from './vertex';
import {PriorityQueue} from '../../priority/queue';

/**
 * Open set entry for `DirectedGraphSearch`. Entries are pooled by the search
 * and reused across calls.
 */
interface SearchEntry<ItemT> {
	vertex: DirectedGraphVertex<ItemT> | null;
	/** Cost of the path from start to vertex when the entry was queued. */
	cost: number;
	/** cost plus the heuristic estimate from vertex to goal. */
	estimate: number;
	/** Push order, so entries with equal estimates pop first in, first out. */
	order: number;
}

/**
 * Reusable A* search state owned by one `DirectedGraph`, used by
 * `findPath()`. Everything a search needs lives here or in the `_search*`
 * scratch fields of each vertex, stamped with the id of the search that wrote
 * them, so nothing has to be reset between searches. Once the open set and
 * the entry pool have grown to the largest search so far, a search allocates
 * only its result path (or nothing, when the caller passes one to fill).
 *
 * Internal to `DirectedGraph`; not part of the public API.
 */
export class DirectedGraphSearch<ItemT> {
	/** Id of the running search, or of the last one. Only increases. */
	public id: number;
	/** True while a search runs, so a nested call can be refused. */
	public active: boolean;
	public goal: DirectedGraphVertex<ItemT> | null;
	public heuristic: DirectedGraphHeuristic<ItemT> | null;
	/** Cost to the vertex being expanded, read by `relaxEdge`. */
	public currentCost: number;
	/** Next push order. */
	public order: number;
	/** Entries handed out by the running search. */
	public used: number;
	public readonly entries: SearchEntry<ItemT>[];
	public readonly open: PriorityQueue<SearchEntry<ItemT>>;

	constructor() {
		this.id = 0;
		this.active = false;
		this.goal = null;
		this.heuristic = null;
		this.currentCost = 0;
		this.order = 0;
		this.used = 0;
		this.entries = [];
		this.open = new PriorityQueue<SearchEntry<ItemT>>(compareEntries);
	}

	/**
	 * Cheapest path from start to goal, as `DirectedGraph.findPath()`
	 * documents. The caller has checked both vertices belong to the graph.
	 * @returns		The path, or null when goal cannot be reached or a search is
	 * 				already running (a heuristic calling `findPath` on the same
	 * 				graph).
	 */
	public run(
		start: DirectedGraphVertex<ItemT>,
		goal: DirectedGraphVertex<ItemT>,
		heuristic: DirectedGraphHeuristic<ItemT> | null | undefined,
		out: DirectedGraphPath<ItemT> | null | undefined
	): DirectedGraphPath<ItemT> | null {
		if (this.active) {
			return null;
		}

		this.active = true;
		this.id++;
		this.goal = goal;
		this.heuristic = typeof heuristic === 'function' ? heuristic : null;

		try {
			this.reach(start, 0, null);
			this.push(start);

			while (!this.open.isEmpty()) {
				const entry = this.open.pop() as SearchEntry<ItemT>;
				const vertex = entry.vertex as DirectedGraphVertex<ItemT>;

				// A cheaper path to this vertex was found after this entry was queued.
				if (entry.cost > vertex._searchCost) {
					continue;
				}

				if (vertex === goal) {
					return buildPath(start, goal, out);
				}

				this.currentCost = entry.cost;
				// Map.forEach with a shared callback: no iterator, entry array,
				// or closure per expanded vertex.
				vertex._out.forEach(relaxEdge, this);
			}

			return null;
		} finally {
			this.finish();
		}
	}

	/**
	 * Record a path of cost to vertex arriving over via. The first time the
	 * running search reaches vertex, its scratch fields are claimed and its
	 * heuristic estimate is computed, once per vertex per search.
	 */
	public reach(
		vertex: DirectedGraphVertex<ItemT>,
		cost: number,
		via: DirectedGraphEdge<ItemT> | null
	): void {
		if (vertex._searchId !== this.id) {
			vertex._searchId = this.id;
			vertex._searchEstimate = this.estimate(vertex);
		}

		vertex._searchCost = cost;
		vertex._searchVia = via;
	}

	/** Queue vertex at its current cost, using a pooled entry. */
	public push(vertex: DirectedGraphVertex<ItemT>): void {
		let entry = this.entries[this.used];

		if (entry === undefined) {
			entry = {vertex: null, cost: 0, estimate: 0, order: 0};
			this.entries.push(entry);
		}

		this.used++;
		entry.vertex = vertex;
		entry.cost = vertex._searchCost;
		entry.estimate = vertex._searchCost + vertex._searchEstimate;
		entry.order = this.order++;
		this.open.push(entry);
	}

	private estimate(vertex: DirectedGraphVertex<ItemT>): number {
		if (this.heuristic === null) {
			return 0;
		}

		const result = this.heuristic(vertex, this.goal as DirectedGraphVertex<ItemT>);
		return Number.isFinite(result) && result > 0 ? result : 0;
	}

	/**
	 * Empty the open set and drop every reference the search holds, so removed
	 * vertices and the caller's heuristic are not kept alive. Capacity is kept.
	 */
	private finish(): void {
		this.open.clearElements();

		for (let i = 0; i < this.used; i++) {
			this.entries[i].vertex = null;
		}

		this.used = 0;
		this.order = 0;
		this.goal = null;
		this.heuristic = null;
		this.active = false;
	}
}

/** Min-heap order on estimate, then push order. */
function compareEntries<ItemT>(a: SearchEntry<ItemT>, b: SearchEntry<ItemT>): boolean {
	return a.estimate < b.estimate || (a.estimate === b.estimate && a.order < b.order);
}

/**
 * `Map.prototype.forEach` callback over the expanded vertex's `_out` map,
 * with the search as `this`.
 */
function relaxEdge<ItemT>(
	this: DirectedGraphSearch<ItemT>,
	edge: DirectedGraphEdge<ItemT>,
	next: DirectedGraphVertex<ItemT>
): void {
	const cost = this.currentCost + edge._weight;

	if (next._searchId !== this.id || cost < next._searchCost) {
		this.reach(next, cost, edge);
		this.push(next);
	}
}

/**
 * Walk the via edges back from goal to start, then reverse them in place into
 * a path. An edge traveled both ways may have been crossed from `_to` to
 * `_from`, so each step takes whichever end is not the current vertex.
 * @param out	Path to fill instead of allocating one, when its arrays are
 * 				arrays.
 */
function buildPath<ItemT>(
	start: DirectedGraphVertex<ItemT>,
	goal: DirectedGraphVertex<ItemT>,
	out: DirectedGraphPath<ItemT> | null | undefined
): DirectedGraphPath<ItemT> {
	let path: DirectedGraphPath<ItemT>;

	if (out && Array.isArray(out.vertices) && Array.isArray(out.edges)) {
		path = out;
	} else {
		path = {vertices: [], edges: [], cost: 0};
	}

	// Overwrite by index, goal first, then cut to length and reverse in place.
	// Emptying the arrays first with `length = 0` would free their storage.
	const vertices = path.vertices;
	const edges = path.edges;
	let count = 0;
	let curr = goal;
	vertices[0] = goal;

	while (curr !== start) {
		const edge = curr._searchVia as DirectedGraphEdge<ItemT>;
		curr = (edge._to === curr ? edge._from : edge._to) as DirectedGraphVertex<ItemT>;
		edges[count] = edge;
		count++;
		vertices[count] = curr;
	}

	if (vertices.length !== count + 1) {
		vertices.length = count + 1;
	}
	if (edges.length !== count) {
		edges.length = count;
	}

	path.vertices.reverse();
	path.edges.reverse();
	path.cost = goal._searchCost;

	return path;
}
