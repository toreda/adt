import type {RedBlackTree} from '../tree';
import type {RedBlackTreeElement} from './element';
import {type IterableType} from '../../../iterable/type';

/**
 * Iterates RedBlackTree items in sorted (in-order) order, smallest first, by
 * following successor links. Holds no stack, so memory use is constant.
 *
 * @remarks
 * Every `next()` call returns the same result object, updated in place, so
 * stepping allocates nothing. `for...of` and spread read each result before
 * the next step, so they are unaffected. Code calling `next()` by hand must
 * copy `value` before calling it again. The iterator itself is still one
 * allocation per loop; `RedBlackTree.forEach()` allocates nothing.
 *
 * @category Red Black Tree
 */
export class RedBlackTreeIterator<ItemT> implements Iterator<ItemT | null> {
	private readonly tree: RedBlackTree<ItemT>;
	private item: RedBlackTreeElement<ItemT> | null;
	/** Returned by every `next()` call, updated in place. */
	private readonly result: IterableType<ItemT | null>;

	constructor(tree: RedBlackTree<ItemT>) {
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
