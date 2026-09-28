import type {BinarySearchTree} from '../tree.js';
import type {BinarySearchTreeElement} from './element.js';
import {type IterableType} from '../../../iterable/type.js';
import {iterableMakeType} from '../../../iterable/helpers.js';

/**
 * Iterates BinarySearchTree items in sorted (in-order) order, smallest first,
 * by following successor links. Holds no stack, so memory use is constant.
 *
 * @category Binary Search Tree
 */
export class BinarySearchTreeIterator<ItemT> implements Iterator<ItemT | null> {
	private readonly tree: BinarySearchTree<ItemT>;
	private item: BinarySearchTreeElement<ItemT> | null;

	constructor(tree: BinarySearchTree<ItemT>) {
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
