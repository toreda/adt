/**
 * Position on the plane, as returned by a `QuadTreeLocator`. Both coordinates
 * must be finite numbers. Any object with numeric `x` and `y` fields fits, so
 * items that already carry their own coordinates can be returned as is.
 *
 * @category Quad Tree
 */
export interface QuadTreePoint {
	x: number;
	y: number;
}
