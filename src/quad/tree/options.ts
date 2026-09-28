import {type DataStructureOptions} from '../../data/structure/options';

/**
 * Optional config provided to the QuadTree constructor. Options are always
 * optional, so nothing here is ever required: every entry falls back to a
 * default when missing or invalid. Pooling options come from
 * `DataStructureOptions`. The locator is required, so it is a constructor
 * argument instead.
 *
 * @category Quad Tree
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface QuadTreeOptions<ItemT> extends DataStructureOptions {
	/**
	 * Whether an item may be added at exactly the position of one already in
	 * the tree. Defaults to `true`; any non-boolean value keeps the default.
	 * When `false`, inserting at an occupied position adds nothing and returns
	 * the `duplicate_not_allowed` error code instead of a node.
	 */
	allowDuplicates?: boolean;
}
