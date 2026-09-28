import type {OctTreePoint} from './point';

/**
 * Reads an item's position for an `OctTree`. Items are generic, so the tree
 * cannot find their coordinates itself. Returning the item itself works when
 * items are already points. Must be consistent: the same item always yields
 * the same position until the tree is told otherwise with `update()`.
 *
 * @category Oct Tree
 */
export interface OctTreeLocator<ItemT> {
	(item: ItemT): OctTreePoint;
}
