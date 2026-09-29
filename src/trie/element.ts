import type {Element} from '../element';
import {type ObjectPoolInstance} from '../object/pool/instance';
import type {Trie} from '../trie';
import {trieCodeSearch} from './code/search';

/**
 * Node in a `Trie`. Each node stands for one key prefix: the root for the
 * empty prefix, and every other node for its parent's prefix plus one UTF-16
 * code unit. A node whose prefix is a whole key is terminal and holds that
 * key's item; other nodes only link to longer prefixes. Implements
 * `ObjectPoolInstance` so the trie can recycle nodes through an internal
 * `ObjectPool`. Links are read-only from outside: only the trie rewires them.
 *
 * @category Trie
 */
export class TrieElement<T> implements Element<T>, ObjectPoolInstance {
	/**
	 * Item held by this node. Managed by `Trie` only; a terminal node always
	 * holds exactly the item that was inserted, including null or undefined
	 * items. Null on every other node.
	 */
	public _value: T | null = null;
	/** Full key of the held item on a terminal node, otherwise null. */
	public _key: string | null = null;
	/** Whether this node's prefix is a whole key, so the node holds an item. */
	public _terminal: boolean = false;
	/** UTF-16 code unit on the link from the parent. 0 for the root and unlinked nodes. */
	public _code: number = 0;
	public _parent: TrieElement<T> | null = null;
	/**
	 * Code unit of each child, sorted ascending, so a child is found by binary
	 * search and children are walked in key order. Parallel to `_children`.
	 */
	public _codes: number[] = [];
	/** Children in the same order as `_codes`. */
	public _children: TrieElement<T>[] = [];
	/**
	 * Trie this node is currently linked into, or null when unlinked. Managed
	 * by `Trie` only; lets it check ownership in O(1).
	 */
	public _trie: Trie<T> | null = null;
	/**
	 * Id of the insert that stored this node's item, unique within `_trie`, or
	 * 0 when the node holds no item. Managed by `Trie` only. Each insert gets a
	 * new id, so a handle that captured an old one can tell the item was
	 * replaced or removed.
	 */
	public _linkId: number = 0;

	/**
	 * @param element	Initial value. Omitted when constructed by an `ObjectPool`,
	 * 					which hands out blank nodes for the trie to fill.
	 */
	constructor(element?: T) {
		if (element !== undefined) {
			this._value = element;
		}
	}

	/**
	 * Reset every field to its blank state. Called by `ObjectPool` on release
	 * so a recycled node never carries a previous item or its links. Any new
	 * field added to this class must be cleared here.
	 */
	public cleanObj(): void {
		this._value = null;
		this._key = null;
		this._terminal = false;
		this._code = 0;
		this._parent = null;
		this._codes.length = 0;
		this._children.length = 0;
		this._trie = null;
		this._linkId = 0;
	}

	/**
	 * Get the node's item, or set it when elementValue is provided. Returns
	 * null for a node that holds no item.
	 *
	 * @remarks
	 * While the node is linked into a trie, a new value is only accepted on a
	 * terminal node, and only when the trie's key selector returns the node's
	 * key for it (e.g. replacing an item with an updated copy under the same
	 * key). Any other value would be stored under the wrong key, so it is
	 * ignored: use the trie's `update()` instead, which moves the item when
	 * needed.
	 */
	public value(elementValue?: T): T | null {
		if (typeof elementValue === 'undefined') {
			return this._value;
		}

		if (this._trie === null || (this._terminal && this._trie.keySelector(elementValue) === this._key)) {
			this._value = elementValue;
		}

		return null;
	}

	/**
	 * Key of the item this node holds.
	 * @returns		The key, or null when the node holds no item.
	 */
	public key(): string | null {
		return this._key;
	}

	/**
	 * True when the node's prefix is a whole key, so it holds an item. Always
	 * true for a leaf other than the root.
	 */
	public isTerminal(): boolean {
		return this._terminal;
	}

	public parent(): TrieElement<T> | null {
		return this._parent;
	}

	/**
	 * Child reached by the first UTF-16 code unit of char, found by binary
	 * search in O(log c) for c children. Allocates nothing.
	 * @returns		The child, or null when there is none or char is not a
	 * 				non-empty string.
	 */
	public child(char: string): TrieElement<T> | null {
		if (typeof char !== 'string' || char.length === 0) {
			return null;
		}

		const index = trieCodeSearch(this._codes, char.charCodeAt(0));

		return index >= 0 ? this._children[index] : null;
	}

	/**
	 * Existing children, in ascending code unit order.
	 *
	 * @remarks
	 * Allocates a new array per call unless `out` is given. `out` is
	 * overwritten by index and then cut to the child count, so its storage is
	 * reused while the count stays the same. V8 frees an array's storage when
	 * its length drops to 0 and trims it when the length shrinks, so a leaf
	 * after a parent, or a larger count after a smaller one, still allocates.
	 * On a hot path, use `child()` instead, which allocates nothing.
	 *
	 * @param out	Optional array to fill and return instead of a new one.
	 */
	public children(out?: TrieElement<T>[]): TrieElement<T>[] {
		const result: TrieElement<T>[] = Array.isArray(out) ? out : [];
		const count = this._children.length;

		for (let i = 0; i < count; i++) {
			result[i] = this._children[i];
		}
		if (result.length !== count) {
			result.length = count;
		}

		return result;
	}

	public isLeaf(): boolean {
		return this._children.length === 0;
	}
}
