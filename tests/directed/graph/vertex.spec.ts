import {DirectedGraph} from '../../../src/directed/graph';
import {DirectedGraphEdge} from '../../../src/directed/graph/edge';
import {DirectedGraphVertex} from '../../../src/directed/graph/vertex';

describe('DirectedGraphVertex', () => {
	it('starts blank or with the given value', () => {
		const blank = new DirectedGraphVertex<string>();

		expect(blank.value()).toBeNull();
		expect(blank.neighbors()).toEqual([]);
		expect(blank.outEdges()).toEqual([]);
		expect(blank.inEdges()).toEqual([]);
		expect(new DirectedGraphVertex('a').value()).toBe('a');
	});

	it('cleanObj resets every field to a fresh vertex', () => {
		const graph = new DirectedGraph<string>();
		const [a, b] = graph.addVertexArray(['a', 'b']);
		graph.addBidirectionalEdge(a, b);
		a.cleanObj();

		expect(a).toEqual(new DirectedGraphVertex<string>());
	});

	it('cleanObj also resets walk and search scratch fields', () => {
		const graph = new DirectedGraph<string>();
		const [a, b] = graph.addVertexArray(['a', 'b']);
		graph.addEdge(a, b, 2);
		graph.depthFirst(a);
		graph.findPath(a, b, () => 1);

		expect(b._searchVia).not.toBeNull();
		expect(b._walkId).not.toBe(0);
		b.cleanObj();

		expect(b).toEqual(new DirectedGraphVertex<string>());
	});

	it('cleanObj leaves empty edge maps untouched', () => {
		const vertex = new DirectedGraphVertex<string>('a');
		const clear = jest.spyOn(Map.prototype, 'clear');

		try {
			vertex.cleanObj();
			expect(clear).not.toHaveBeenCalled();
		} finally {
			clear.mockRestore();
		}
	});

	it('neighbors, outEdges, and inEdges fill a given array', () => {
		const graph = new DirectedGraph<string>();
		const [a, b, c] = graph.addVertexArray(['a', 'b', 'c']);
		const ab = graph.addEdge(a, b) as DirectedGraphEdge<string>;
		const ca = graph.addBidirectionalEdge(c, a) as DirectedGraphEdge<string>;
		const vertices: DirectedGraphVertex<string>[] = [c, c, c];
		const edges: DirectedGraphEdge<string>[] = [];

		expect(a.neighbors(vertices)).toBe(vertices);
		expect(vertices).toEqual([b, c]);
		expect(a.outEdges(edges)).toBe(edges);
		expect(edges).toEqual([ab, ca]);
		expect(a.inEdges(edges)).toBe(edges);
		expect(edges).toEqual([ca]);
		expect(a.neighbors(null)).toEqual([b, c]);
	});

	it('accepts any value, linked or not', () => {
		const graph = new DirectedGraph<string>(['a']);
		const vertex = graph.vertices()[0];

		expect(vertex.value('z')).toBeNull();
		expect(vertex.value()).toBe('z');
		expect(graph.values()).toEqual(['z']);
	});
});

describe('DirectedGraphEdge', () => {
	it('starts blank', () => {
		const blank = new DirectedGraphEdge<string>();

		expect(blank.from()).toBeNull();
		expect(blank.to()).toBeNull();
		expect(blank.weight()).toBe(1);
		expect(blank.isBidirectional()).toBe(false);
	});

	it('cleanObj resets every field to a fresh edge', () => {
		const graph = new DirectedGraph<string>();
		const [a, b] = graph.addVertexArray(['a', 'b']);
		const edge = graph.addBidirectionalEdge(a, b, 4) as DirectedGraphEdge<string>;
		edge.cleanObj();

		expect(edge).toEqual(new DirectedGraphEdge<string>());
	});
});
