import type {QuadTree} from '../tree';
import type {QuadTreeElement} from './element';

/**
 * Callback signature for QuadTree `forEach`, `filter`, `forEachWithinBounds`,
 * and `forEachWithinRadius`. Mirrors the `Map` / `Set` callbacks: the third
 * argument is the tree being walked, not an array. Index counts the elements
 * visited from 0, in the calling method's visit order (pre-order for
 * `forEach` and `filter`).
 *
 * @typeParam ItemT		Item type held by the tree.
 * @typeParam U			Callback return type.
 *
 * @category Quad Tree
 */
export type QuadTreeMethod<ItemT, U> = (
	element: QuadTreeElement<ItemT>,
	index: number,
	tree: QuadTree<ItemT>
) => U;
