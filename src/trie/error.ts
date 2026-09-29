/**
 * Codes returned in place of a node by Trie methods that refuse an item
 * instead of throwing.
 *
 * - `invalid_key`: the key selector returned something other than a string.
 *
 * @category Trie
 */
export type TrieError = 'invalid_key';
