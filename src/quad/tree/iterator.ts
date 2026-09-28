import type {QuadTree} from '../tree';
import type {QuadTreeElement} from './element';
import {type IterableType} from '../../iterable/type';
import {iterableMakeType} from '../../iterable/helpers';

/**
 * Iterates QuadTree items in pre-order, each node before its quadrants, by
 * following parent and child links. Holds no stack, so memory use is constant.
 *
 * @category Quad Tree
 */
export class QuadTreeIterator<ItemT> implements Iterator<ItemT | null> {
	private readonly tree: QuadTree<ItemT>;
	private item: QuadTreeElement<ItemT> | null;

	constructor(tree: QuadTree<ItemT>) {
		this.tree = tree;
		this.item = tree.root();
	}

	public next(): IterableType<ItemT | null> {
		if (!this.item) {
			return iterableMakeType(null, true);
		}

		const value = this.item._value;
		this.item = this.tree.preOrderNext(this.item);

		return iterableMakeType(value, false);
	}
}
