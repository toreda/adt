import {type ADTOptions} from '../../../adt/options';

/**
 * Optional config provided to the BinarySearchTree constructor. Options are
 * always optional, so nothing here is ever required: every entry falls back to
 * a default when missing or invalid. Pooling options come from `ADTOptions`.
 * The comparator is required, so it is a constructor argument instead.
 *
 * @category Binary Search Tree
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface BinarySearchTreeOptions<ItemT> extends ADTOptions {
	/**
	 * Whether an item comparing equal to one already in the tree may be added.
	 * Defaults to `true`; any non-boolean value keeps the default. When
	 * `false`, inserting a duplicate adds nothing and returns the
	 * `duplicate_not_allowed` error code instead of a node.
	 */
	allowDuplicates?: boolean;
}
