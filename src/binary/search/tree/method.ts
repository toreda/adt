import type {BinarySearchTree} from '../tree';
import type {BinarySearchTreeElement} from './element';

/**
 * Callback signature for BinarySearchTree `forEach` and `filter`. Mirrors the
 * `Map` / `Set` callbacks: the third argument is the tree being walked, not an
 * array. Index counts elements in sorted (in-order) order from 0.
 *
 * @typeParam ItemT		Item type held by the tree.
 * @typeParam U			Callback return type.
 *
 * @category Binary Search Tree
 */
export type BinarySearchTreeMethod<ItemT, U> = (
	element: BinarySearchTreeElement<ItemT>,
	index: number,
	tree: BinarySearchTree<ItemT>
) => U;
