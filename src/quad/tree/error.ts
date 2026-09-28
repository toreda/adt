/**
 * Codes returned in place of a node by QuadTree methods that refuse an item
 * instead of throwing.
 *
 * - `invalid_position`: the locator returned something other than an object
 *   with finite numeric `x` and `y` fields.
 * - `duplicate_not_allowed`: an item already sits at exactly the same
 *   position, and the tree was built with `allowDuplicates: false`.
 *
 * @category Quad Tree
 */
export type QuadTreeError = 'invalid_position' | 'duplicate_not_allowed';
