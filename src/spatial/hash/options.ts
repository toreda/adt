import {type SpatialGridOptions} from '../grid/options';

/**
 * Optional config provided to the SpatialHash constructor. Options are always
 * optional, so nothing here is ever required: every entry falls back to a
 * default when missing or invalid. Cell and pooling options come from
 * `SpatialGridOptions`. The locator is required, so it is a constructor
 * argument instead.
 *
 * @category Spatial Hash
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SpatialHashOptions extends SpatialGridOptions {}
