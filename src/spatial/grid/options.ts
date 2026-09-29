import {type DataStructureOptions} from '../../data/structure/options';

/**
 * Optional config shared by `SpatialHash` and `SpatialMap`. Options are always
 * optional, so nothing here is ever required: every entry falls back to a
 * default when missing or invalid. Pooling options come from
 * `DataStructureOptions`.
 *
 * @category Spatial
 */
export interface SpatialGridOptions extends DataStructureOptions {
	/**
	 * Edge length of each cubic cell. Defaults to `1`; any value that is not a
	 * finite number greater than 0 keeps the default. Cell `(cx, cy, cz)` holds
	 * positions whose `floor(x / cellSize)`, `floor(y / cellSize)`, and
	 * `floor(z / cellSize)` equal those cell coordinates.
	 *
	 * @remarks
	 * Queries touch every cell overlapping their search region, so a good cell
	 * size is close to the typical query radius. Cells much smaller than the
	 * queries make each query probe many empty cells; cells much larger make
	 * each probe test many items that are out of range.
	 */
	cellSize?: number;
	/**
	 * Number of occupied cells to size the cell table for at construction.
	 * Defaults to `64`; any value that is not an integer of at least 1 keeps
	 * the default. The table grows past this on demand, so it only avoids the
	 * cost of growing when the eventual cell count is known ahead of time.
	 */
	expectedCellCount?: number;
}
