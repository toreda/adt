import type {RedBlackTree} from '../tree.js';
import type {RedBlackTreeElement} from './element.js';

/**
 * Callback signature for RedBlackTree `forEach` and `filter`. Mirrors the
 * `Map` / `Set` callbacks: the third argument is the tree being walked, not an
 * array. Index counts elements in sorted (in-order) order from 0.
 *
 * @typeParam ItemT		Item type held by the tree.
 * @typeParam U			Callback return type.
 *
 * @category Red Black Tree
 */
export type RedBlackTreeMethod<ItemT, U> = (
	element: RedBlackTreeElement<ItemT>,
	index: number,
	tree: RedBlackTree<ItemT>
) => U;
