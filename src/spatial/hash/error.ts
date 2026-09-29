/**
 * Codes returned in place of an element by SpatialHash methods that refuse an
 * item instead of throwing.
 *
 * - `invalid_position`: the locator returned something other than an object
 *   with finite numeric `x`, `y`, and `z` fields, or a position whose cell
 *   coordinate on some axis lies outside the int32 range (see `cellSize`).
 *
 * @category Spatial Hash
 */
export type SpatialHashError = 'invalid_position';
