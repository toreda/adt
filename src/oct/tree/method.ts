import type {OctTree} from '../tree';
import type {OctTreeElement} from './element';

/**
 * Callback signature for OctTree `forEach` and `filter`. Mirrors the
 * `Map` / `Set` callbacks: the third argument is the tree being walked, not an
 * array. Index counts elements in pre-order from 0.
 *
 * @typeParam ItemT		Item type held by the tree.
 * @typeParam U			Callback return type.
 *
 * @category Oct Tree
 */
export type OctTreeMethod<ItemT, U> = (
	element: OctTreeElement<ItemT>,
	index: number,
	tree: OctTree<ItemT>
) => U;
