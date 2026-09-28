import type {QuadTreePoint} from './point';

/**
 * Reads an item's position for a `QuadTree`. Items are generic, so the tree
 * cannot find their coordinates itself. Returning the item itself works when
 * items are already points. Must be consistent: the same item always yields
 * the same position until the tree is told otherwise with `update()`.
 *
 * @category Quad Tree
 */
export interface QuadTreeLocator<ItemT> {
	(item: ItemT): QuadTreePoint;
}
