import {DirectedGraph} from '../../src/directed/graph';
import {DirectedGraphEdge} from '../../src/directed/graph/edge';
import {DirectedGraphIterator} from '../../src/directed/graph/iterator';
import {DirectedGraphVertex} from '../../src/directed/graph/vertex';
import {ObjectPool} from '../../src/object/pool';

type Vertex = DirectedGraphVertex<string>;
type Edge = DirectedGraphEdge<string>;

const vertexPoolOf = (target: DirectedGraph<any>): ObjectPool<any> | null =>
	(target as any).vertexPool.objectPool;
const edgePoolOf = (target: DirectedGraph<any>): ObjectPool<any> | null => (target as any).edgePool.objectPool;
const itemsOf = (vertices: DirectedGraphVertex<string>[]): (string | null)[] => vertices.map((v) => v.value());

/**
 * Build a graph from a compact description. `a>b` adds a one-way edge,
 * `a-b` a bidirectional edge, and `a>b:4` gives it weight 4. Vertices are
 * added in order of first mention.
 */
const build = (spec: string[], extra: string[] = []): {graph: DirectedGraph<string>; v: Record<string, Vertex>} => {
	const graph = new DirectedGraph<string>();
	const v: Record<string, Vertex> = {};
	const vertex = (name: string): Vertex => (v[name] ??= graph.addVertex(name));

	for (const name of extra) {
		vertex(name);
	}

	for (const entry of spec) {
		const [link, weight] = entry.split(':');
		const bidirectional = link.includes('-');
		const [from, to] = link.split(bidirectional ? '-' : '>');
		const w = weight === undefined ? undefined : Number(weight);
		const result = bidirectional
			? graph.addBidirectionalEdge(vertex(from), vertex(to), w)
			: graph.addEdge(vertex(from), vertex(to), w);

		expect(result).toBeInstanceOf(DirectedGraphEdge);
	}

	return {graph, v};
};

/**
 * Check every structural rule: each edge is listed in the maps of exactly the
 * vertices it connects, in each direction it can be traveled, and nowhere
 * else, and every wrapper is owned by the graph.
 */
const expectValid = <T>(graph: DirectedGraph<T>): void => {
	const vertices = new Set(graph.vertices());
	let outCount = 0;
	let inCount = 0;

	for (const edge of graph.edges()) {
		const from = edge.from()!;
		const to = edge.to()!;

		expect(edge._graph).toBe(graph);
		expect(vertices.has(from)).toBe(true);
		expect(vertices.has(to)).toBe(true);
		expect(from._out.get(to)).toBe(edge);
		expect(to._in.get(from)).toBe(edge);
		expect(edge.weight()).toBeGreaterThanOrEqual(0);

		if (edge.isBidirectional()) {
			expect(to._out.get(from)).toBe(edge);
			expect(from._in.get(to)).toBe(edge);
		}

		const directions = edge.isBidirectional() && from !== to ? 2 : 1;
		outCount += directions;
		inCount += directions;
	}

	for (const vertex of vertices) {
		expect(vertex._graph).toBe(graph);
		outCount -= vertex.outDegree();
		inCount -= vertex.inDegree();
	}

	expect(outCount).toBe(0);
	expect(inCount).toBe(0);
};

/**
 * Reference cycle check by exhaustive search: from each vertex, try every path
 * of distinct vertices, and report a cycle when an unused edge leads back to
 * the start. Only practical for tiny graphs.
 */
const bruteForceHasCycle = <T>(graph: DirectedGraph<T>): boolean => {
	const search = (
		start: DirectedGraphVertex<T>,
		vertex: DirectedGraphVertex<T>,
		visited: Set<DirectedGraphVertex<T>>,
		used: Set<DirectedGraphEdge<T>>
	): boolean => {
		for (const [next, edge] of vertex._out) {
			if (used.has(edge)) {
				continue;
			}
			if (next === start) {
				return true;
			}
			if (visited.has(next)) {
				continue;
			}

			visited.add(next);
			used.add(edge);
			if (search(start, next, visited, used)) {
				return true;
			}
			visited.delete(next);
			used.delete(edge);
		}

		return false;
	};

	return graph.vertices().some((start) => search(start, start, new Set([start]), new Set()));
};

/** Reference all-pairs cheapest costs with Floyd-Warshall. */
const floydWarshall = <T>(graph: DirectedGraph<T>): Map<DirectedGraphVertex<T>, Map<DirectedGraphVertex<T>, number>> => {
	const vertices = graph.vertices();
	const dist = new Map(vertices.map((a) => [a, new Map(vertices.map((b) => [b, a === b ? 0 : Infinity]))]));

	for (const a of vertices) {
		for (const [b, edge] of a._out) {
			const row = dist.get(a)!;
			row.set(b, Math.min(row.get(b)!, edge.weight()));
		}
	}

	for (const k of vertices) {
		for (const i of vertices) {
			for (const j of vertices) {
				const through = dist.get(i)!.get(k)! + dist.get(k)!.get(j)!;
				if (through < dist.get(i)!.get(j)!) {
					dist.get(i)!.set(j, through);
				}
			}
		}
	}

	return dist;
};

/** 32-bit LCG. Math.imul keeps the multiply exact, and the high bits vary best. */
const seeded = (seed: number): ((bound: number) => number) => {
	return (bound) => {
		seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
		return (seed >>> 16) % bound;
	};
};

/** Random graph mixing one-way and bidirectional edges, with small weights. */
const randomGraph = (random: (bound: number) => number, count: number, edges: number): DirectedGraph<string> => {
	const graph = new DirectedGraph<string>();
	const vertices = graph.addVertexArray(new Array(count).fill(0).map((_, i) => String(i)));

	for (let i = 0; i < edges; i++) {
		const from = vertices[random(count)];
		const to = vertices[random(count)];
		const weight = random(10);

		if (random(2) === 0) {
			graph.addEdge(from, to, weight);
		} else {
			graph.addBidirectionalEdge(from, to, weight);
		}
	}

	return graph;
};

const graph = new DirectedGraph<string>();

describe('DirectedGraph', () => {
	beforeEach(() => {
		graph.reset();
		expect(graph.isEmpty()).toBe(true);
	});

	describe('INSTANTIATION', () => {
		it('empty', () => {
			const result = new DirectedGraph<string>();

			expect(result).toBeInstanceOf(DirectedGraph);
			expect(result.size()).toBe(0);
			expect(result.edgeCount()).toBe(0);
			expect(result.vertices()).toEqual([]);
			expect(result.edges()).toEqual([]);
		});

		it('with items added as vertices in array order, without edges', () => {
			const result = new DirectedGraph<string>(['a', 'b', 'c']);

			expect(result.size()).toBe(3);
			expect(result.values()).toEqual(['a', 'b', 'c']);
			expect(result.edgeCount()).toBe(0);
		});

		it('does not keep a reference to the provided array', () => {
			const items = ['a'];
			const result = new DirectedGraph<string>(items);
			items.push('b');

			expect(result.size()).toBe(1);
		});

		it('ignores invalid data and options instead of throwing', () => {
			expect(new DirectedGraph('adsf' as any).size()).toBe(0);
			expect(new DirectedGraph(null).size()).toBe(0);
			expect(new DirectedGraph({elements: [4]} as any).size()).toBe(0);
			expect(new DirectedGraph(['a'], null).size()).toBe(1);
			expect(new DirectedGraph(['a'], 'nope' as any).size()).toBe(1);
		});
	});

	describe('ELEMENT POOLING', () => {
		it('is enabled by default for vertices and edges', () => {
			expect(vertexPoolOf(new DirectedGraph())).toBeInstanceOf(ObjectPool);
			expect(edgePoolOf(new DirectedGraph())).toBeInstanceOf(ObjectPool);
		});

		it('only strict true disables it', () => {
			const plain = new DirectedGraph([], {disableElementPooling: true});
			const pooled = new DirectedGraph([], {disableElementPooling: 'true' as any});

			expect(vertexPoolOf(plain)).toBeNull();
			expect(edgePoolOf(plain)).toBeNull();
			expect(vertexPoolOf(pooled)).toBeInstanceOf(ObjectPool);
			expect(edgePoolOf(pooled)).toBeInstanceOf(ObjectPool);
		});

		it('recycles a removed vertex for a later add', () => {
			const first = graph.addVertex('a');
			graph.removeVertex(first);
			const second = graph.addVertex('b');

			expect(second).toBe(first);
			expect(second.value()).toBe('b');
			expect(second.outDegree()).toBe(0);
			expect(graph.values()).toEqual(['b']);
		});

		it('recycles a removed edge for a later add', () => {
			const [a, b, c] = graph.addVertexArray(['a', 'b', 'c']);
			const first = graph.addBidirectionalEdge(a, b, 5) as Edge;
			graph.removeEdge(first);
			const second = graph.addEdge(b, c) as Edge;

			expect(second).toBe(first);
			expect(second.from()).toBe(b);
			expect(second.to()).toBe(c);
			expect(second.weight()).toBe(1);
			expect(second.isBidirectional()).toBe(false);
			expectValid(graph);
		});

		it('reuses pooled wrappers instead of allocating in steady state', () => {
			const pooled = new DirectedGraph<number>([], {pool: {startSize: 4}});
			const seenVertices = new Set<unknown>();
			const seenEdges = new Set<unknown>();

			for (let round = 0; round < 50; round++) {
				const [a, b, c, d] = pooled.addVertexArray([round, round + 1, round + 2, round + 3]);
				pooled.addEdge(a, b);
				pooled.addBidirectionalEdge(b, c);
				pooled.addEdge(c, d);
				pooled.addEdge(d, a);
				pooled.forEach((vertex) => seenVertices.add(vertex));
				pooled.edges().forEach((edge) => seenEdges.add(edge));
				pooled.removeVertex(b);
				pooled.clearElements();
			}

			expect(seenVertices.size).toBe(4);
			expect(seenEdges.size).toBe(4);
		});

		it('does not recycle when pooling is disabled', () => {
			const plain = new DirectedGraph<string>([], {disableElementPooling: true});
			const [a, b] = plain.addVertexArray(['a', 'b']);
			const edge = plain.addEdge(a, b) as Edge;
			plain.removeVertex(a);

			expect(plain.addVertex('c')).not.toBe(a);
			expect(a.value()).toBe('a');
			expect(a._graph).toBeNull();
			expect(edge._graph).toBeNull();
			expect(edge.from()).toBeNull();
			expect(plain.addEdge(b, b)).not.toBe(edge);
		});

		it('filter keeps the pooling options', () => {
			const plain = new DirectedGraph<string>(['a'], {disableElementPooling: true});

			expect(vertexPoolOf(plain.filter(() => true))).toBeNull();
			expect(edgePoolOf(plain.filter(() => true))).toBeNull();
		});
	});

	describe('vertices', () => {
		it('addVertex returns the vertex holding the item', () => {
			const vertex = graph.addVertex('a');

			expect(vertex).toBeInstanceOf(DirectedGraphVertex);
			expect(vertex.value()).toBe('a');
			expect(graph.size()).toBe(1);
			expect(graph.vertices()).toEqual([vertex]);
		});

		it('allows the same item in several vertices', () => {
			const first = graph.addVertex('a');
			const second = graph.addVertex('a');

			expect(first).not.toBe(second);
			expect(graph.values()).toEqual(['a', 'a']);
			expect(graph.find('a')).toBe(first);
		});

		it('stores null and undefined items as given', () => {
			const anything = new DirectedGraph<string | null | undefined>([null, undefined, 'a']);

			expect(anything.values()).toEqual([null, undefined, 'a']);
			expect(anything.find(undefined)).toBe(anything.vertices()[1]);
		});

		it('addVertexArray ignores non-arrays', () => {
			expect(graph.addVertexArray(null)).toEqual([]);
			expect(graph.addVertexArray('abc' as any)).toEqual([]);
			expect(graph.size()).toBe(0);
		});

		it('find and contains match like Array.includes', () => {
			const numbers = new DirectedGraph<number>([1, NaN, 0]);

			expect(numbers.find(NaN)).toBe(numbers.vertices()[1]);
			expect(numbers.find(-0)).toBe(numbers.vertices()[2]);
			expect(numbers.contains(1)).toBe(true);
			expect(numbers.contains(5)).toBe(false);
			expect(numbers.find(5)).toBeNull();
		});

		it('removeVertex removes every edge touching it', () => {
			const {graph: g, v} = build(['a>b', 'b>c', 'c>b', 'b-d', 'e>e', 'b>b']);

			expect(g.removeVertex(v.b)).toBe('b');
			expect(g.values()).toEqual(['a', 'c', 'd', 'e']);
			expect(g.edgeCount()).toBe(1);
			expect(v.a.outDegree()).toBe(0);
			expect(v.c.outDegree()).toBe(0);
			expect(v.c.inDegree()).toBe(0);
			expect(v.d.outDegree()).toBe(0);
			expect(v.d.inDegree()).toBe(0);
			expectValid(g);
		});

		it('removeVertex returns null for null, foreign, and stale vertices', () => {
			const other = new DirectedGraph<string>(['x']);
			const vertex = graph.addVertex('a');

			expect(graph.removeVertex(null)).toBeNull();
			expect(graph.removeVertex(other.vertices()[0])).toBeNull();
			expect(graph.removeVertex(new DirectedGraphVertex('a'))).toBeNull();
			expect(graph.removeVertex(vertex)).toBe('a');
			expect(graph.removeVertex(vertex)).toBeNull();
			expect(other.size()).toBe(1);
		});

		it('clears the removed vertex', () => {
			const {graph: g, v} = build(['a>b', 'b-c']);
			g.removeVertex(v.b);

			expect(v.b.value()).toBeNull();
			expect(v.b.outDegree()).toBe(0);
			expect(v.b.inDegree()).toBe(0);
			expect(v.b._graph).toBeNull();
		});
	});

	describe('edges', () => {
		it('addEdge adds a one-way edge with weight 1 by default', () => {
			const [a, b] = graph.addVertexArray(['a', 'b']);
			const edge = graph.addEdge(a, b) as Edge;

			expect(edge).toBeInstanceOf(DirectedGraphEdge);
			expect(edge.from()).toBe(a);
			expect(edge.to()).toBe(b);
			expect(edge.weight()).toBe(1);
			expect(edge.isBidirectional()).toBe(false);
			expect(graph.adjacent(a, b)).toBe(true);
			expect(graph.adjacent(b, a)).toBe(false);
			expect(graph.edge(a, b)).toBe(edge);
			expect(graph.edge(b, a)).toBeNull();
			expect(graph.edgeCount()).toBe(1);
			expectValid(graph);
		});

		it('addBidirectionalEdge adds one edge traveled both ways', () => {
			const [a, b] = graph.addVertexArray(['a', 'b']);
			const edge = graph.addBidirectionalEdge(a, b, 2.5) as Edge;

			expect(edge.isBidirectional()).toBe(true);
			expect(edge.weight()).toBe(2.5);
			expect(graph.edge(a, b)).toBe(edge);
			expect(graph.edge(b, a)).toBe(edge);
			expect(graph.neighbors(a)).toEqual([b]);
			expect(graph.neighbors(b)).toEqual([a]);
			expect(graph.edgeCount()).toBe(1);
			expectValid(graph);
		});

		it('allows one-way edges in both directions as separate edges', () => {
			const [a, b] = graph.addVertexArray(['a', 'b']);
			const there = graph.addEdge(a, b, 1) as Edge;
			const back = graph.addEdge(b, a, 3) as Edge;

			expect(there).not.toBe(back);
			expect(graph.edge(b, a)?.weight()).toBe(3);
			expect(graph.edgeCount()).toBe(2);
			expectValid(graph);
		});

		it('allows loops of either kind', () => {
			const [a, b] = graph.addVertexArray(['a', 'b']);

			expect(graph.addEdge(a, a)).toBeInstanceOf(DirectedGraphEdge);
			expect(graph.addBidirectionalEdge(b, b)).toBeInstanceOf(DirectedGraphEdge);
			expect(graph.neighbors(a)).toEqual([a]);
			expect(graph.neighbors(b)).toEqual([b]);
			expect(graph.addEdge(b, b)).toBe('edge_exists');
			expectValid(graph);
		});

		it('refuses an edge covering a direction already covered', () => {
			const [a, b, c] = graph.addVertexArray(['a', 'b', 'c']);
			graph.addEdge(a, b);
			graph.addBidirectionalEdge(b, c);

			expect(graph.addEdge(a, b)).toBe('edge_exists');
			expect(graph.addBidirectionalEdge(a, b)).toBe('edge_exists');
			expect(graph.addBidirectionalEdge(b, a)).toBe('edge_exists');
			expect(graph.addEdge(b, c)).toBe('edge_exists');
			expect(graph.addEdge(c, b)).toBe('edge_exists');
			expect(graph.addBidirectionalEdge(c, b)).toBe('edge_exists');
			expect(graph.edgeCount()).toBe(2);
		});

		it('refuses edges to vertices outside the graph', () => {
			const a = graph.addVertex('a');
			const foreign = new DirectedGraph<string>(['x']).vertices()[0];

			expect(graph.addEdge(a, null)).toBe('vertex_not_in_graph');
			expect(graph.addEdge(null, a)).toBe('vertex_not_in_graph');
			expect(graph.addEdge(a, foreign)).toBe('vertex_not_in_graph');
			expect(graph.addBidirectionalEdge(foreign, a)).toBe('vertex_not_in_graph');
			expect(graph.addEdge(a, new DirectedGraphVertex('b'))).toBe('vertex_not_in_graph');
			expect(graph.edgeCount()).toBe(0);
		});

		it('refuses weights that are not finite numbers of 0 or more', () => {
			const [a, b] = graph.addVertexArray(['a', 'b']);
			const allocatedBefore = edgePoolOf(graph)!.size();

			for (const invalid of [-1, NaN, Infinity, -Infinity, null, '1', {}]) {
				expect(graph.addEdge(a, b, invalid as any)).toBe('invalid_weight');
				expect(graph.addBidirectionalEdge(a, b, invalid as any)).toBe('invalid_weight');
			}

			expect(graph.edgeCount()).toBe(0);
			expect(edgePoolOf(graph)!.size()).toBe(allocatedBefore);
			expect((graph.addEdge(a, b, 0) as Edge).weight()).toBe(0);
		});

		it('edge weight can be changed to valid values only', () => {
			const [a, b] = graph.addVertexArray(['a', 'b']);
			const edge = graph.addEdge(a, b, 2) as Edge;

			expect(edge.weight(7)).toBe(7);
			expect(edge.weight(-1)).toBe(7);
			expect(edge.weight(NaN)).toBe(7);
			expect(edge.weight('3' as any)).toBe(7);
			expect(edge.weight(0)).toBe(0);
		});

		it('removeEdge unlinks one-way and bidirectional edges', () => {
			const {graph: g, v} = build(['a>b', 'b-c', 'c>c']);

			expect(g.removeEdge(g.edge(v.c, v.b))).toBe(true);
			expect(g.adjacent(v.b, v.c)).toBe(false);
			expect(g.removeEdge(g.edge(v.c, v.c))).toBe(true);
			expect(g.edgeCount()).toBe(1);
			expect(g.size()).toBe(3);
			expectValid(g);
		});

		it('removeEdge returns false for null, foreign, and stale edges', () => {
			const {graph: g, v} = build(['a>b']);
			const other = build(['a>b']).graph;
			const edge = g.edge(v.a, v.b);

			expect(g.removeEdge(null)).toBe(false);
			expect(g.removeEdge(other.edges()[0])).toBe(false);
			expect(g.removeEdge(new DirectedGraphEdge())).toBe(false);
			expect(g.removeEdge(edge)).toBe(true);
			expect(g.removeEdge(edge)).toBe(false);
			expect(other.edgeCount()).toBe(1);
		});

		it('edge, adjacent, and neighbors handle null and foreign vertices', () => {
			const {graph: g, v} = build(['a>b']);
			const foreign = new DirectedGraphVertex('a');

			expect(g.edge(null, v.b)).toBeNull();
			expect(g.edge(v.a, null)).toBeNull();
			expect(g.edge(foreign, v.b)).toBeNull();
			expect(g.adjacent(v.a, foreign)).toBe(false);
			expect(g.neighbors(null)).toEqual([]);
			expect(g.neighbors(foreign)).toEqual([]);
		});

		it('vertex exposes its edges and degrees', () => {
			const {v} = build(['a>b', 'c>a', 'a-d']);

			expect(itemsOf(v.a.neighbors())).toEqual(['b', 'd']);
			expect(v.a.outEdges().map((e) => e.to()?.value())).toEqual(['b', 'd']);
			expect(v.a.inEdges().map((e) => e.from()?.value())).toEqual(['c', 'a']);
			expect(v.a.outDegree()).toBe(2);
			expect(v.a.inDegree()).toBe(2);
		});
	});

	describe('breadthFirst', () => {
		it('visits by distance, neighbors in edge order', () => {
			const {graph: g, v} = build(['a>b', 'a>c', 'b>d', 'c>d', 'd>e', 'c>f']);

			expect(itemsOf(g.breadthFirst(v.a))).toEqual(['a', 'b', 'c', 'd', 'f', 'e']);
			expect(itemsOf(g.breadthFirst(v.d))).toEqual(['d', 'e']);
		});

		it('follows edges only in their direction of travel', () => {
			const {graph: g, v} = build(['a>b', 'b-c']);

			expect(itemsOf(g.breadthFirst(v.c))).toEqual(['c', 'b']);
			expect(itemsOf(g.breadthFirst(v.a))).toEqual(['a', 'b', 'c']);
		});

		it('handles cycles and loops', () => {
			const {graph: g, v} = build(['a>b', 'b>c', 'c>a', 'a>a']);

			expect(itemsOf(g.breadthFirst(v.b))).toEqual(['b', 'c', 'a']);
		});

		it('walks every vertex when start is omitted', () => {
			const {graph: g} = build(['b>a', 'c>d'], ['a', 'b', 'c', 'd', 'e']);

			expect(itemsOf(g.breadthFirst())).toEqual(['a', 'b', 'c', 'd', 'e']);
		});

		it('returns nothing for null or foreign start', () => {
			const {graph: g} = build(['a>b']);

			expect(g.breadthFirst(null)).toEqual([]);
			expect(g.breadthFirst(new DirectedGraphVertex('a'))).toEqual([]);
			expect(new DirectedGraph().breadthFirst()).toEqual([]);
		});
	});

	describe('depthFirst', () => {
		it('matches recursive pre order, neighbors in edge order', () => {
			const {graph: g, v} = build(['a>b', 'a>c', 'b>d', 'c>d', 'd>e', 'c>f']);

			expect(itemsOf(g.depthFirst(v.a))).toEqual(['a', 'b', 'd', 'e', 'c', 'f']);
		});

		it('follows edges only in their direction of travel', () => {
			const {graph: g, v} = build(['a>b', 'b-c', 'd>c']);

			expect(itemsOf(g.depthFirst(v.c))).toEqual(['c', 'b']);
		});

		it('walks every vertex when start is omitted', () => {
			const {graph: g} = build(['b>a', 'c>d', 'd>b'], ['a', 'b', 'c', 'd', 'e']);

			expect(itemsOf(g.depthFirst())).toEqual(['a', 'b', 'c', 'd', 'e']);
		});

		it('handles a long chain without overflowing the stack', () => {
			const count = 50000;
			const chain = new DirectedGraph<number>();
			const vertices = chain.addVertexArray(new Array(count).fill(0).map((_, i) => i));
			for (let i = 1; i < count; i++) {
				chain.addEdge(vertices[i - 1], vertices[i]);
			}

			expect(chain.depthFirst(vertices[0]).length).toBe(count);
			expect(chain.breadthFirst(vertices[0]).length).toBe(count);
			expect(chain.hasCycle()).toBe(false);
			expect(chain.findPath(vertices[0], vertices[count - 1])?.cost).toBe(count - 1);
			chain.addEdge(vertices[count - 1], vertices[0]);
			expect(chain.hasCycle()).toBe(true);
		});

		it('returns nothing for null or foreign start', () => {
			const {graph: g} = build(['a>b']);

			expect(g.depthFirst(null)).toEqual([]);
			expect(g.depthFirst(new DirectedGraphVertex('a'))).toEqual([]);
		});
	});

	describe('hasCycle', () => {
		const cases: [string, string[], boolean][] = [
			['empty graph', [], false],
			['one-way chain', ['a>b', 'b>c'], false],
			['diamond', ['a>b', 'a>c', 'b>d', 'c>d'], false],
			['one-way cycle', ['a>b', 'b>c', 'c>a'], true],
			['one-way loop', ['a>a'], true],
			['bidirectional loop', ['a-a'], true],
			['opposite one-way edges', ['a>b', 'b>a'], true],
			['single bidirectional edge', ['a-b'], false],
			['bidirectional tree', ['a-b', 'b-c', 'b-d'], false],
			['bidirectional triangle', ['a-b', 'b-c', 'c-a'], true],
			['one-way edge alongside a bidirectional path', ['a-b', 'b-c', 'a>c'], true],
			['one-way edges joining two bidirectional trees', ['a-b', 'c-d', 'a>c', 'd>b'], true],
			['one-way edges between trees, no way back', ['a-b', 'c-d', 'a>c', 'b>d'], false],
			['cycle only through mixed edges', ['a-b', 'a>c', 'c>b'], true],
			['cycle in second component', ['a>b', 'c>d', 'd>e', 'e>c'], true]
		];

		for (const [name, spec, expected] of cases) {
			it(`${expected ? 'finds' : 'finds no'} cycle: ${name}`, () => {
				const {graph: g} = build(spec);

				expect(g.hasCycle()).toBe(expected);
				expect(bruteForceHasCycle(g)).toBe(expected);
			});
		}

		it('agrees with exhaustive search on random mixed graphs', () => {
			const random = seeded(99);
			let withCycle = 0;

			for (let i = 0; i < 400; i++) {
				const g = randomGraph(random, 2 + random(5), random(8));
				const expected = bruteForceHasCycle(g);

				expect(g.hasCycle()).toBe(expected);
				withCycle += expected ? 1 : 0;
			}

			// Both answers must be well represented for the check to mean anything.
			expect(withCycle).toBeGreaterThan(50);
			expect(withCycle).toBeLessThan(350);
		});

		it('follows removals', () => {
			const {graph: g, v} = build(['a>b', 'b>c', 'c>a']);
			g.removeEdge(g.edge(v.c, v.a));

			expect(g.hasCycle()).toBe(false);
		});
	});

	describe('findPath', () => {
		it('finds the cheapest path, not the shortest', () => {
			const {graph: g, v} = build(['a>b:1', 'b>d:9', 'a>c:1', 'c>e:1', 'e>d:0.5', 'a>d:5']);
			const path = g.findPath(v.a, v.d)!;

			expect(itemsOf(path.vertices)).toEqual(['a', 'c', 'e', 'd']);
			expect(path.edges).toEqual([g.edge(v.a, v.c), g.edge(v.c, v.e), g.edge(v.e, v.d)]);
			expect(path.cost).toBe(2.5);
		});

		it('travels bidirectional edges backwards', () => {
			const {graph: g, v} = build(['a-b:2', 'c-b:3']);
			const path = g.findPath(v.c, v.a)!;

			expect(itemsOf(path.vertices)).toEqual(['c', 'b', 'a']);
			expect(path.cost).toBe(5);
		});

		it('never travels a one-way edge backwards', () => {
			const {graph: g, v} = build(['a>b', 'b>c']);

			expect(g.findPath(v.c, v.a)).toBeNull();
			expect(g.findPath(v.a, v.c)?.cost).toBe(2);
		});

		it('returns a path of just start when start is goal', () => {
			const {graph: g, v} = build(['a>b']);
			const path = g.findPath(v.a, v.a)!;

			expect(path.vertices).toEqual([v.a]);
			expect(path.edges).toEqual([]);
			expect(path.cost).toBe(0);
		});

		it('returns null for null, foreign, or unreachable vertices', () => {
			const {graph: g, v} = build(['a>b'], ['c']);
			const foreign = new DirectedGraphVertex('a');

			expect(g.findPath(null, v.b)).toBeNull();
			expect(g.findPath(v.a, null)).toBeNull();
			expect(g.findPath(foreign, v.b)).toBeNull();
			expect(g.findPath(v.a, v.c)).toBeNull();
		});

		it('handles zero weight cycles', () => {
			const {graph: g, v} = build(['a>b:0', 'b>a:0', 'b>c:0', 'c>b:0', 'c>d:1']);

			expect(g.findPath(v.a, v.d)?.cost).toBe(1);
		});

		describe('on a grid', () => {
			type Cell = {x: number; y: number};
			const size = 30;
			let calls = 0;
			const manhattan = (vertex: DirectedGraphVertex<Cell>, goal: DirectedGraphVertex<Cell>): number => {
				calls++;
				const a = vertex.value()!;
				const b = goal.value()!;
				return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
			};
			const makeGrid = (): {grid: DirectedGraph<Cell>; cells: DirectedGraphVertex<Cell>[][]} => {
				const grid = new DirectedGraph<Cell>();
				const cells: DirectedGraphVertex<Cell>[][] = [];

				for (let x = 0; x < size; x++) {
					cells.push([]);
					for (let y = 0; y < size; y++) {
						cells[x].push(grid.addVertex({x, y}));
						if (x > 0) {
							grid.addBidirectionalEdge(cells[x - 1][y], cells[x][y]);
						}
						if (y > 0) {
							grid.addBidirectionalEdge(cells[x][y - 1], cells[x][y]);
						}
					}
				}

				return {grid, cells};
			};

			beforeEach(() => {
				calls = 0;
			});

			it('the heuristic steers the search straight to the goal', () => {
				const {grid, cells} = makeGrid();
				const path = grid.findPath(cells[0][0], cells[size - 1][0], manhattan)!;

				expect(path.cost).toBe(size - 1);
				// Only cells along the way and their neighbors are estimated,
				// instead of most of the grid.
				expect(calls).toBeLessThan(4 * size);
			});

			it('finds the same cost as without a heuristic around a wall', () => {
				const {grid, cells} = makeGrid();

				// Wall down the middle with one gap at the far end.
				for (let y = 0; y < size - 1; y++) {
					grid.removeEdge(grid.edge(cells[14][y], cells[15][y]));
				}

				const start = cells[0][0];
				const goal = cells[size - 1][0];
				const guided = grid.findPath(start, goal, manhattan)!;
				const blind = grid.findPath(start, goal)!;

				expect(guided.cost).toBe(blind.cost);
				expect(guided.cost).toBe(size - 1 + 2 * (size - 1));
				expect(guided.vertices[0]).toBe(start);
				expect(guided.vertices[guided.vertices.length - 1]).toBe(goal);
			});
		});

		it('treats invalid heuristic results as 0', () => {
			const {graph: g, v} = build(['a>b:1', 'b>c:1', 'a>c:5']);

			for (const invalid of [NaN, -3, Infinity, 'x', null]) {
				expect(g.findPath(v.a, v.c, () => invalid as any)?.cost).toBe(2);
			}
			expect(g.findPath(v.a, v.c, 'nope' as any)?.cost).toBe(2);
		});

		it('matches Floyd-Warshall costs on random mixed graphs', () => {
			const random = seeded(1234);

			for (let round = 0; round < 40; round++) {
				const g = randomGraph(random, 8, 20);
				const dist = floydWarshall(g);

				for (const a of g.vertices()) {
					for (const b of g.vertices()) {
						const expected = dist.get(a)!.get(b)!;
						const path = g.findPath(a, b);

						if (expected === Infinity) {
							expect(path).toBeNull();
							continue;
						}

						expect(path!.cost).toBe(expected);
						expect(path!.vertices[0]).toBe(a);
						expect(path!.vertices[path!.vertices.length - 1]).toBe(b);
						expect(path!.edges.length).toBe(path!.vertices.length - 1);
						// Every step is an edge that can be traveled that way.
						let sum = 0;
						path!.edges.forEach((edge, i) => {
							expect(g.edge(path!.vertices[i], path!.vertices[i + 1])).toBe(edge);
							sum += edge.weight();
						});
						expect(sum).toBe(expected);
					}
				}
			}
		});
	});

	describe('iteration and forEach', () => {
		it('iterates items in insertion order', () => {
			graph.addVertexArray(['a', 'b', 'c']);

			expect(graph[Symbol.iterator]()).toBeInstanceOf(DirectedGraphIterator);
			expect([...graph]).toEqual(['a', 'b', 'c']);
			expect([...new DirectedGraph()]).toEqual([]);
		});

		it('visits vertices in insertion order with index and graph', () => {
			graph.addVertexArray(['a', 'b']);
			const seen: [string | null, number][] = [];
			graph.forEach((vertex, index, source) => {
				expect(source).toBe(graph);
				seen.push([vertex.value(), index]);
			});

			expect(seen).toEqual([
				['a', 0],
				['b', 1]
			]);
		});

		it('passes thisArg as given', () => {
			graph.addVertex('a');
			const context = {};
			let received: unknown = null;
			graph.forEach(function (this: unknown) {
				received = this;
			}, context);

			expect(received).toBe(context);
		});

		it('allows removing the current vertex', () => {
			const {graph: g} = build(['a>b', 'b>c', 'c>d', 'd>a']);
			g.forEach((vertex) => {
				if (vertex.value() === 'b' || vertex.value() === 'c') {
					g.removeVertex(vertex);
				}
			});

			expect(g.values()).toEqual(['a', 'd']);
			expect(g.edgeCount()).toBe(1);
			expectValid(g);
		});

		it('returns the graph', () => {
			expect(graph.forEach(() => undefined)).toBe(graph);
		});
	});

	describe('filter', () => {
		it('keeps matching vertices and the edges between them', () => {
			const {graph: g} = build(['a>b:2', 'b-c:3', 'c>d', 'a>d', 'c>c:4']);
			const kept = g.filter((vertex) => vertex.value() !== 'd');

			expect(kept).toBeInstanceOf(DirectedGraph);
			expect(kept).not.toBe(g);
			expect(kept.values()).toEqual(['a', 'b', 'c']);
			expect(JSON.parse(kept.stringify()!).edges).toEqual([
				{from: 0, to: 1, weight: 2, bidirectional: false},
				{from: 1, to: 2, weight: 3, bidirectional: true},
				{from: 2, to: 2, weight: 4, bidirectional: false}
			]);
			expect(g.size()).toBe(4);
			expect(g.edgeCount()).toBe(5);
			expectValid(kept);
		});

		it('returns an empty graph when nothing matches', () => {
			const {graph: g} = build(['a>b']);

			expect(g.filter(() => false).size()).toBe(0);
		});
	});

	describe('query', () => {
		beforeEach(() => graph.addVertexArray(['apple', 'bean', 'avocado', 'corn']));

		it('matches in insertion order', () => {
			const results = graph.query((v) => v.startsWith('a'));

			expect(results.map((r) => r.element.value())).toEqual(['apple', 'avocado']);
			expect(results[0].index()).toBeNull();
			expect(results[0].key()).toBeNull();
		});

		it('requires every filter in an array', () => {
			expect(graph.query([(v) => v.startsWith('a'), (v) => v.length > 5]).map((r) => r.element.value())).toEqual(
				['avocado']
			);
			expect(graph.query([])).toEqual([]);
		});

		it('respects the limit', () => {
			expect(graph.query(() => true, {limit: 2}).map((r) => r.element.value())).toEqual(['apple', 'bean']);
			expect(graph.query(() => true, {limit: 0}).length).toBe(4);
			expect(graph.query(() => true, {limit: NaN}).length).toBe(4);
		});

		it('delete removes the vertex and its edges once', () => {
			const [apple, bean] = graph.vertices();
			graph.addEdge(apple, bean);
			const [match] = graph.query((v) => v === 'bean');

			expect(match.delete()).toBe('bean');
			expect(match.delete()).toBeNull();
			expect(graph.values()).toEqual(['apple', 'avocado', 'corn']);
			expect(graph.edgeCount()).toBe(0);
			expectValid(graph);
		});

		it('stale delete does not remove the item that reused its vertex', () => {
			const [match] = graph.query((v) => v === 'bean');

			expect(match.delete()).toBe('bean');
			const reused = graph.addVertex('pea');

			expect(reused).toBe(match.element);
			expect(match.delete()).toBeNull();
			expect(graph.values()).toEqual(['apple', 'avocado', 'corn', 'pea']);
		});
	});

	describe('stringify', () => {
		it('serializes vertices in order and edges by vertex index', () => {
			const {graph: g} = build(['a>b:2', 'b-c'], ['c']);

			expect(JSON.parse(g.stringify() as string)).toEqual({
				type: 'DirectedGraph',
				vertices: ['c', 'a', 'b'],
				edges: [
					{from: 1, to: 2, weight: 2, bidirectional: false},
					{from: 2, to: 0, weight: 1, bidirectional: true}
				]
			});
		});

		it('returns null for items that cannot be serialized', () => {
			expect(new DirectedGraph<bigint>([BigInt(1)]).stringify()).toBeNull();
		});
	});

	describe('clearElements / reset', () => {
		it('unlinks every vertex and edge and empties the graph', () => {
			const {graph: g} = build(['a>b', 'b-c']);
			const vertices = g.vertices();
			const edges = g.edges();
			g.clearElements();

			expect(g.size()).toBe(0);
			expect(g.edgeCount()).toBe(0);
			for (const vertex of vertices) {
				expect(vertex._graph).toBeNull();
				expect(vertex.outDegree()).toBe(0);
				expect(vertex.inDegree()).toBe(0);
			}
			for (const edge of edges) {
				expect(edge._graph).toBeNull();
				expect(edge.from()).toBeNull();
			}
		});

		it('reset returns the graph, which stays usable', () => {
			graph.addVertexArray(['a', 'b']);

			expect(graph.reset()).toBe(graph);
			const [a, b] = graph.addVertexArray(['c', 'd']);
			graph.addEdge(a, b);
			expect(graph.values()).toEqual(['c', 'd']);
			expectValid(graph);
		});
	});

	describe('stays valid across random changes', () => {
		it('adds and removes vertices and edges', () => {
			const random = seeded(5);
			const g = new DirectedGraph<number>();

			for (let i = 0; i < 3000; i++) {
				const vertices = g.vertices();
				const action = random(10);

				if (action < 3 || vertices.length < 2) {
					g.addVertex(i);
				} else if (action < 6) {
					g.addEdge(vertices[random(vertices.length)], vertices[random(vertices.length)], random(5));
				} else if (action < 8) {
					g.addBidirectionalEdge(vertices[random(vertices.length)], vertices[random(vertices.length)]);
				} else if (action < 9) {
					const edges = g.edges();
					g.removeEdge(edges.length ? edges[random(edges.length)] : null);
				} else {
					g.removeVertex(vertices[random(vertices.length)]);
				}

				if (i % 100 === 0) {
					expectValid(g);
				}
			}

			expectValid(g);
		});
	});
});
