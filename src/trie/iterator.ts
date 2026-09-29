import type {Trie} from '../trie';
import type {TrieElement} from './element';
import {type IterableType} from '../iterable/type';

/**
 * Iterates Trie items in key order, by following successor links. Holds no
 * stack, so memory use is constant.
 *
 * @remarks
 * `next()` allocates nothing: every call returns the same result object,
 * updated in place. Read `value` / `done` before calling `next()` again, as
 * `for...of` and spread do. Keeping a result object across calls sees it
 * change.
 *
 * @category Trie
 */
export class TrieIterator<ItemT> implements Iterator<ItemT | null> {
	private readonly trie: Trie<ItemT>;
	private item: TrieElement<ItemT> | null;
	/** Result returned by every `next()` call, reused to avoid allocation. */
	private readonly result: IterableType<ItemT | null>;

	constructor(trie: Trie<ItemT>) {
		this.trie = trie;
		this.item = trie.min();
		this.result = {value: null, done: false};
	}

	public next(): IterableType<ItemT | null> {
		const result = this.result;

		if (!this.item) {
			result.value = null;
			result.done = true;
			return result;
		}

		result.value = this.item._value;
		result.done = false;
		this.item = this.trie.successor(this.item);

		return result;
	}
}
