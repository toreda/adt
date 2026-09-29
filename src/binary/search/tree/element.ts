import type {BinarySearchTree} from '../tree';
import {type ObjectPoolInstance} from '../../../object/pool/instance';
import {type TreeElement} from '../../../tree/element';

/**
 * Node wrapping one item in a `BinarySearchTree`. Implements
 * `ObjectPoolInstance` so the tree can recycle nodes through an internal
 * `ObjectPool`. Links are read-only from outside: only the tree rewires them,
 * since any other change could break its ordering.
 *
 * @category Binary Search Tree
 */
export class BinarySearchTreeElement<T> implements TreeElement<T>, ObjectPoolInstance {
	/**
	 * Item held by this node. Managed by `BinarySearchTree` only; a linked node
	 * always holds exactly the item that was inserted, including null or
	 * undefined items.
	 */
	public _value: T | null = null;
	public _left: BinarySearchTreeElement<T> | null = null;
	public _right: BinarySearchTreeElement<T> | null = null;
	public _parent: BinarySearchTreeElement<T> | null = null;
	/**
	 * Tree this node is currently linked into, or null when unlinked. Managed
	 * by `BinarySearchTree` only; lets it check ownership in O(1).
	 */
	public _tree: BinarySearchTree<T> | null = null;
	/**
	 * Id of the insert that linked this node, unique within `_tree`, or 0 when
	 * unlinked. Managed by `BinarySearchTree` only. A recycled node gets a new
	 * id, so a handle that captured the old one can tell the node was reissued.
	 */
	public _linkId: number = 0;

	/**
	 * @param element	Initial value. Omitted when constructed by an `ObjectPool`,
	 * 					which hands out blank nodes for the tree to fill.
	 */
	constructor(element?: T) {
		if (element !== undefined) {
			this._value = element;
		}
	}

	/**
	 * Reset every field to its blank state. Called by `ObjectPool` on release
	 * so a recycled node never carries a previous item or its links. Any new
	 * field added to this class must be cleared here.
	 */
	public cleanObj(): void {
		this._value = null;
		this._left = null;
		this._right = null;
		this._parent = null;
		this._tree = null;
		this._linkId = 0;
	}

	/**
	 * Get the node's value, or set it when elementValue is provided.
	 *
	 * @remarks
	 * While the node is linked into a tree, a new value is only accepted when
	 * the tree's comparator rates it equal to the current one (e.g. replacing
	 * an item with an updated copy under the same key). Any other value would
	 * break the search order, so it is ignored: use the tree's `update()`
	 * instead, which moves the item when needed.
	 */
	public value(elementValue?: T): T | null {
		if (typeof elementValue === 'undefined') {
			return this._value;
		}

		if (this._tree === null || this._tree.comparator(elementValue, this._value as T) === 0) {
			this._value = elementValue;
		}

		return null;
	}

	/** Child holding smaller items, or null when there is none. */
	public left(): BinarySearchTreeElement<T> | null {
		return this._left;
	}

	/** Child holding equal or larger items, or null when there is none. */
	public right(): BinarySearchTreeElement<T> | null {
		return this._right;
	}

	public parent(): BinarySearchTreeElement<T> | null {
		return this._parent;
	}

	/**
	 * Existing children, left before right.
	 *
	 * @remarks
	 * Allocates a new array per call unless `out` is given. `out` is
	 * overwritten by index and then cut to the child count, so its storage is
	 * reused while the count stays the same. V8 frees an array's storage when
	 * its length drops to 0 and trims it when the length shrinks, so a leaf
	 * after a parent, or a larger count after a smaller one, still allocates.
	 * On a hot path, read `left()` / `right()` instead, which allocate nothing.
	 *
	 * @param out	Optional array to fill and return instead of a new one.
	 */
	public children(out?: BinarySearchTreeElement<T>[]): BinarySearchTreeElement<T>[] {
		const result: BinarySearchTreeElement<T>[] = Array.isArray(out) ? out : [];
		let count = 0;

		if (this._left) {
			result[count++] = this._left;
		}
		if (this._right) {
			result[count++] = this._right;
		}
		if (result.length !== count) {
			result.length = count;
		}

		return result;
	}

	public isLeaf(): boolean {
		return this._left === null && this._right === null;
	}
}
