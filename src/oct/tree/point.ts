/**
 * Position in 3D space, as returned by an `OctTreeLocator`. Every coordinate
 * must be a finite number. Any object with numeric `x`, `y`, and `z` fields
 * fits, so items that already carry their own coordinates can be returned as
 * is.
 *
 * @category Oct Tree
 */
export interface OctTreePoint {
	x: number;
	y: number;
	z: number;
}
