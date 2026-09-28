/**
 * Three-way comparison used to order a `BinarySearchTree`, following the
 * `Array.prototype.sort` convention: negative when a sorts before b, positive
 * when a sorts after b, zero when they are equal. Must be consistent: the same
 * pair always compares the same way while both are in the tree.
 *
 * @category Binary Search Tree
 */
export interface BinarySearchTreeComparator<ItemT> {
	(a: ItemT, b: ItemT): number;
}
