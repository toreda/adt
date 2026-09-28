import {type DataStructureOptions} from '../../../data/structure/options';

/**
 * Optional config provided to the RedBlackTree constructor. Options are always
 * optional, so nothing here is ever required: every entry falls back to a
 * default when missing or invalid. Pooling options come from
 * `DataStructureOptions`. The comparator is required, so it is a constructor
 * argument instead.
 *
 * @category Red Black Tree
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface RedBlackTreeOptions<ItemT> extends DataStructureOptions {
	/**
	 * Whether an item comparing equal to one already in the tree may be added.
	 * Defaults to `true`; any non-boolean value keeps the default. When
	 * `false`, inserting a duplicate adds nothing and returns the
	 * `duplicate_not_allowed` error code instead of a node.
	 */
	allowDuplicates?: boolean;
}
