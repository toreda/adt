import type {SpatialMap} from '../map';
import type {SpatialElement} from '../element';

/**
 * Callback signature for SpatialMap `forEach`, `filter`, `forEachWithinBounds`,
 * and `forEachWithinRadius`. Mirrors the `Map` / `Set` callbacks: the third
 * argument is the map being walked, not an array. Index counts the elements
 * visited from 0, in the calling method's visit order (insertion order for
 * `forEach` and `filter`).
 *
 * @typeParam ItemT		Item type held by the map.
 * @typeParam U			Callback return type.
 *
 * @category Spatial Map
 */
export type SpatialMapMethod<ItemT, U> = (
	element: SpatialElement<ItemT>,
	index: number,
	map: SpatialMap<ItemT>
) => U;
