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
