import type {RedBlackTree} from '../tree.js';
import type {RedBlackTreeElement} from './element.js';
import {type IterableType} from '../../../iterable/type.js';
import {iterableMakeType} from '../../../iterable/helpers.js';

/**
 * Iterates RedBlackTree items in sorted (in-order) order, smallest first, by
 * following successor links. Holds no stack, so memory use is constant.
 *
 * @category Red Black Tree
 */
export class RedBlackTreeIterator<ItemT> implements Iterator<ItemT | null> {
	private readonly tree: RedBlackTree<ItemT>;
	private item: RedBlackTreeElement<ItemT> | null;

	constructor(tree: RedBlackTree<ItemT>) {
		this.tree = tree;
		this.item = tree.min();
	}

	public next(): IterableType<ItemT | null> {
		if (!this.item) {
			return iterableMakeType(null, true);
		}

		const value = this.item._value;
		this.item = this.tree.successor(this.item);

		return iterableMakeType(value, false);
	}
}
