import {type SpatialGridOptions} from '../grid/options';

/**
 * Optional config provided to the SpatialMap constructor. Options are always
 * optional, so nothing here is ever required: every entry falls back to a
 * default when missing or invalid. Cell and pooling options come from
 * `SpatialGridOptions`. The locator is required, so it is a constructor
 * argument instead.
 *
 * @category Spatial Map
 */
export interface SpatialMapOptions extends SpatialGridOptions {
	/**
	 * What happens when an item is inserted or moved into a cell another item
	 * holds. Defaults to `false`; any non-boolean value keeps the default.
	 * When `false`, the item is refused with the `cell_occupied` error code
	 * and the occupant stays. When `true`, the occupant is removed and the
	 * item takes its cell, like `Map.prototype.set()` replacing a value.
	 */
	overwrite?: boolean;
}
