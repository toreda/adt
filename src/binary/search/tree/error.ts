/**
 * Codes returned in place of a node by BinarySearchTree methods that refuse
 * an item instead of throwing.
 *
 * - `duplicate_not_allowed`: the item compares equal to one already in the
 *   tree, and the tree was built with `allowDuplicates: false`.
 * - `undefined_item`: the item is `undefined`, which is never stored. Only
 *   returned while `allowUndefinedItem` is on; when it is `false`, the insert
 *   throws instead.
 *
 * @category Binary Search Tree
 */
export type BinarySearchTreeError = 'duplicate_not_allowed' | 'undefined_item';
