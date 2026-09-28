import {type Element} from '../element';

/**
 * Base contract for the nodes of every tree ADT. A node wraps one item and
 * exposes its links so callers can walk the tree in any direction. Each tree
 * extends this with its own links (e.g. `left()` / `right()` in binary trees).
 *
 * @category Tree
 */
export interface TreeElement<ItemT> extends Element<ItemT> {
	/** Node this one hangs from, or null for the root and unlinked nodes. */
	parent(): TreeElement<ItemT> | null;
	/** Direct children, in the tree's own child order. Empty for a leaf. */
	children(): TreeElement<ItemT>[];
	/** True when the node has no children. */
	isLeaf(): boolean;
}
