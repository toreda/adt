/**
 * Three-way comparison used to order a `RedBlackTree`, following the
 * `Array.prototype.sort` convention: negative when a sorts before b, positive
 * when a sorts after b, zero when they are equal. Must be consistent: the same
 * pair always compares the same way while both are in the tree.
 *
 * @category Red Black Tree
 */
export interface RedBlackTreeComparator<ItemT> {
	(a: ItemT, b: ItemT): number;
}
