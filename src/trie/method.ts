import type {Trie} from '../trie';
import type {TrieElement} from './element';

/**
 * Callback signature for Trie `forEach`, `forEachWithPrefix`, and `filter`.
 * Mirrors the `Map` / `Set` callbacks: the third argument is the trie being
 * walked, not an array. Index counts visited items in key order from 0.
 *
 * @typeParam ItemT		Item type held by the trie.
 * @typeParam U			Callback return type.
 *
 * @category Trie
 */
export type TrieMethod<ItemT, U> = (element: TrieElement<ItemT>, index: number, trie: Trie<ItemT>) => U;
