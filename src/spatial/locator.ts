import type {SpatialPoint} from './point';

/**
 * Reads an item's position for a `SpatialHash` or `SpatialMap`. Items are
 * generic, so the data structure cannot find their coordinates itself.
 * Returning the item itself works when items are already points. Must be
 * consistent: the same item always yields the same position until the data
 * structure is told otherwise with `update()`.
 *
 * @category Spatial
 */
export interface SpatialLocator<ItemT> {
	(item: ItemT): SpatialPoint;
}
