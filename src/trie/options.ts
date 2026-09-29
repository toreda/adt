import {type DataStructureOptions} from '../data/structure/options';

/**
 * Optional config provided to the Trie constructor. Options are always
 * optional, so nothing here is ever required: every entry falls back to a
 * default when missing or invalid. Pooling options come from `DataStructureOptions`.
 * The key selector is required, so it is a constructor argument instead.
 *
 * @category Trie
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface, @typescript-eslint/no-unused-vars
export interface TrieOptions<ItemT> extends DataStructureOptions {}
