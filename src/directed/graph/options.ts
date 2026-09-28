import {type DataStructureOptions} from '../../data/structure/options';

/**
 * Optional config provided to the DirectedGraph constructor. Options are
 * always optional, so nothing here is ever required: every entry falls back
 * to a default when missing or invalid. Pooling options come from
 * `DataStructureOptions` and apply to both vertex and edge wrappers.
 *
 * @category Directed Graph
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface, @typescript-eslint/no-unused-vars
export interface DirectedGraphOptions<ItemT> extends DataStructureOptions {}
