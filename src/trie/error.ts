/**
 * Codes returned in place of a node by Trie methods that refuse an item
 * instead of throwing.
 *
 * - `invalid_key`: the key selector returned something other than a string
 *   for the item.
 * - `undefined_item`: the item was undefined and `allowUndefinedItem` is on,
 *   so the call was skipped as a no-op. The key selector is never called for
 *   an undefined item. With the option off, these methods throw instead.
 *
 * @category Trie
 */
export type TrieError = 'invalid_key' | 'undefined_item';
