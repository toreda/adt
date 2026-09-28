/**
 * Codes returned in place of a node by BinarySearchTree methods that refuse
 * an item instead of throwing.
 *
 * - `duplicate_not_allowed`: the item compares equal to one already in the
 *   tree, and the tree was built with `allowDuplicates: false`.
 *
 * @category Binary Search Tree
 */
export type BinarySearchTreeError = 'duplicate_not_allowed';
