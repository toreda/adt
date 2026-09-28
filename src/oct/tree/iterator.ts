import type {OctTree} from '../tree';
import type {OctTreeElement} from './element';
import {type IterableType} from '../../iterable/type';
import {iterableMakeType} from '../../iterable/helpers';

/**
 * Iterates OctTree items in pre-order, each node before its octants, by
 * following parent and child links. Holds no stack, so memory use is constant.
 *
 * @category Oct Tree
 */
export class OctTreeIterator<ItemT> implements Iterator<ItemT | null> {
	private readonly tree: OctTree<ItemT>;
	private item: OctTreeElement<ItemT> | null;

	constructor(tree: OctTree<ItemT>) {
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
