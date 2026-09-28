import {type DataStructure} from './data/structure';
import {type TreeElement} from './tree/element';

/**
 * Base contract shared by every tree data structure: a rooted hierarchy of nodes, each
 * wrapping one item. Insertion and lookup rules differ per tree (ordered,
 * spatial, balanced), so they belong to each implementation, not this base.
 *
 * @typeParam ItemT		Item type held by the tree.
 * @typeParam ElementT	Node type the tree hands out.
 *
 * @category Tree
 */
export interface Tree<ItemT, ElementT extends TreeElement<ItemT> = TreeElement<ItemT>> extends DataStructure<ItemT> {
	/** Topmost node, or null when the tree is empty. */
	root(): ElementT | null;
	/** Number of items in the tree. */
	size(): number;
	/** True when the tree holds no items. */
	isEmpty(): boolean;
	/**
	 * Number of edges on the longest path from the root down to a leaf. A tree
	 * holding only a root has height 0, and an empty tree has height -1.
	 */
	height(): number;
	/**
	 * Number of edges between element and the root, so the root has depth 0.
	 * @returns		Depth, or null when element is null or not part of this tree.
	 */
	depth(element: ElementT | null): number | null;
	/** Every item, in the traversal order the implementation documents. */
	values(): ItemT[];
}
