import {type ADTOptions} from '../../adt/options';

/**
 * Optional config provided to the LinkedList constructor. Options are always
 * optional, so nothing here is ever required: every entry falls back to a
 * default when missing or invalid. Pooling options come from `ADTOptions`.
 *
 * @category Linked List
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface, @typescript-eslint/no-unused-vars
export interface LinkedListOptions<ItemT> extends ADTOptions {}
