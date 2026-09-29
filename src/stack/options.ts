import {type DataStructureOptions} from '../data/structure/options';

/**
 * Optional config provided to the Stack constructor. Options are always
 * optional, so nothing here is ever required. Initial elements are the
 * constructor's `data` argument, not an option.
 *
 * The pooling entries from `DataStructureOptions` have no effect: the stack
 * stores elements directly in its backing array and allocates no element
 * wrappers.
 *
 * @category Stack
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface, @typescript-eslint/no-unused-vars
export interface StackOptions<ItemT> extends DataStructureOptions {}
