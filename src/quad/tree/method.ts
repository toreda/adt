import type {QuadTree} from '../tree';
import type {QuadTreeElement} from './element';

/**
 * Callback signature for QuadTree `forEach` and `filter`. Mirrors the
 * `Map` / `Set` callbacks: the third argument is the tree being walked, not an
 * array. Index counts elements in pre-order from 0.
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
