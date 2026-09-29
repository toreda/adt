/**
 * Position in 3D space, as returned by a `SpatialLocator`. Every coordinate
 * must be a finite number. Any object with numeric `x`, `y`, and `z` fields
 * fits, so items that already carry their own coordinates can be returned as
 * is. For 2D use, return 0 for `z`.
 *
 * @category Spatial
 */
export interface SpatialPoint {
	x: number;
	y: number;
	z: number;
}
