import type {SpatialElement} from '../element';

/**
 * Callback run by `SpatialGrid` walks. owner is the data structure the grid
 * backs, passed through so each data structure's own callback type
 * (`SpatialHashMethod`, `SpatialMapMethod`) receives itself.
 *
 * @category Spatial
 */
export type SpatialGridVisitor<ItemT, OwnerT> = (
	element: SpatialElement<ItemT>,
	index: number,
	owner: OwnerT
) => unknown;
