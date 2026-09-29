/**
 * Axis-aligned box used by `withinBounds()` on `SpatialHash` and `SpatialMap`.
 * Both faces are inclusive on each axis, so a position lying on a face is
 * inside. Every value must be a finite number, and each min must not exceed
 * its max.
 *
 * @category Spatial
 */
export interface SpatialBounds {
	minX: number;
	minY: number;
	minZ: number;
	maxX: number;
	maxY: number;
	maxZ: number;
}
