import type {BinarySearchTree} from '../tree';
import type {BinarySearchTreeElement} from './element';
import {type IterableType} from '../../../iterable/type';

/**
 * Iterates BinarySearchTree items in sorted (in-order) order, smallest first,
 * by following successor links. Holds no stack, so memory use is constant.
 *
 * @remarks
 * `next()` allocates nothing: every call returns the same result object,
 * updated in place. Read `value` / `done` before calling `next()` again, as
 * `for...of` and spread do. Keeping a result object across calls sees it
 * change.
 *
 * @category Binary Search Tree
 */
export class BinarySearchTreeIterator<ItemT> implements Iterator<ItemT | null> {
	private readonly tree: BinarySearchTree<ItemT>;
	private item: BinarySearchTreeElement<ItemT> | null;
	/** Result returned by every `next()` call, reused to avoid allocation. */
	private readonly result: IterableType<ItemT | null>;

	constructor(tree: BinarySearchTree<ItemT>) {
		this.tree = tree;
		this.item = tree.min();
		this.result = {value: null, done: false};
	}

	public next(): IterableType<ItemT | null> {
		const result = this.result;

		if (!this.item) {
			result.value = null;
			result.done = true;
			return result;
		}

		result.value = this.item._value;
		result.done = false;
		this.item = this.tree.successor(this.item);

		return result;
	}
}
