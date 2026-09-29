/**
 * Codes returned in place of a node by RedBlackTree methods that refuse an
 * item instead of throwing.
 *
 * - `duplicate_not_allowed`: the item compares equal to one already in the
 *   tree, and the tree was built with `allowDuplicates: false`.
 * - `undefined_item`: the item is `undefined`, which is never stored. Only
 *   returned while `allowUndefinedItem` is on; when it is `false`, the insert
 *   throws instead.
 *
 * @category Red Black Tree
 */
export type RedBlackTreeError = 'duplicate_not_allowed' | 'undefined_item';
