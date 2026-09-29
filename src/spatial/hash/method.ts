import type {SpatialHash} from '../hash';
import type {SpatialElement} from '../element';

/**
 * Callback signature for SpatialHash `forEach`, `filter`,
 * `forEachWithinBounds`, and `forEachWithinRadius`. Mirrors the `Map` / `Set`
 * callbacks: the third argument is the hash being walked, not an array. Index
 * counts the elements visited from 0, in the calling method's visit order
 * (insertion order for `forEach` and `filter`).
 *
 * @typeParam ItemT		Item type held by the hash.
 * @typeParam U			Callback return type.
 *
 * @category Spatial Hash
 */
export type SpatialHashMethod<ItemT, U> = (
	element: SpatialElement<ItemT>,
	index: number,
	hash: SpatialHash<ItemT>
) => U;
