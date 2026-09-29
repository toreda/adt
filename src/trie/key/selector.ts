/**
 * Reads an item's key for a `Trie`. Items are generic, so the trie cannot find
 * their keys itself. Returning the item itself works when items are already
 * strings: `new Trie<string>((word) => word)`. Must be consistent: the same
 * item always yields the same key until the trie is told otherwise with
 * `update()`.
 *
 * @category Trie
 */
export interface TrieKeySelector<ItemT> {
	(item: ItemT): string;
}
