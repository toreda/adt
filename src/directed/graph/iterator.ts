import type {DirectedGraphVertex} from './vertex.js';
import {type IterableType} from '../../iterable/type.js';
import {iterableMakeType} from '../../iterable/helpers.js';

/**
 * Iterates DirectedGraph items in vertex insertion order. Reads the graph's
 * vertex set as it goes, so no copy of the vertices is made.
 *
 * @category Directed Graph
 */
export class DirectedGraphIterator<ItemT> implements Iterator<ItemT | null> {
	private readonly source: Iterator<DirectedGraphVertex<ItemT>>;

	/**
	 * @param source	Iterator over the graph's vertices, in insertion order.
	 */
	constructor(source: Iterator<DirectedGraphVertex<ItemT>>) {
		this.source = source;
	}

	public next(): IterableType<ItemT | null> {
		const result = this.source.next();

		if (result.done) {
			return iterableMakeType(null, true);
		}

		return iterableMakeType(result.value._value, false);
	}
}
