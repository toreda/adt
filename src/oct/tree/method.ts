import type {OctTree} from '../tree';
import type {OctTreeElement} from './element';

/**
 * Callback signature for OctTree `forEach`, `filter`, `forEachWithinBounds`,
 * and `forEachWithinRadius`. Mirrors the `Map` / `Set` callbacks: the third
 * argument is the tree being walked, not an array. Index counts the elements
 * visited from 0, in the calling method's visit order (pre-order for
 * `forEach` and `filter`).
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
