import type {DataStructure} from './data/structure';
import {ElementPool} from './element/pool';
import type {ObjectPoolConstructor} from './object/pool/constructor';
import type {QueryFilter} from './query/filter';
import type {QueryOptions} from './query/options';
import type {QueryResult} from './query/result';
import {trieCodeSearch} from './trie/code/search';
import {TrieElement} from './trie/element';
import type {TrieError} from './trie/error';
import {TrieIterator} from './trie/iterator';
import type {TrieKeySelector} from './trie/key/selector';
import type {TrieMethod} from './trie/method';
import type {TrieOptions} from './trie/options';
import {booleanValue} from './boolean/value';
import {isNumber, undefinedItemSkip} from './utility';

/** Pick for `collect()` keeping the node itself, as `withPrefix()` returns. */
function trieNodeOf<T>(node: TrieElement<T>): TrieElement<T> {
	return node;
}

/** Pick for `collect()` reading the node's key, as `keysWithPrefix()` returns. */
function trieKeyOf<T>(node: TrieElement<T>): string {
	return node._key as string;
}

/** Pick for `collect()` reading the node's item, as `values()` returns. */
function trieValueOf<T>(node: TrieElement<T>): T {
	return node._value as T;
}

/** Insert value at index, shifting later entries up. Unlike `splice`, allocates no result array. */
function arrayInsertAt<T>(arr: T[], index: number, value: T): void {
	for (let i = arr.length; i > index; i--) {
		arr[i] = arr[i - 1];
	}

	arr[index] = value;
}

/** Remove the entry at index, shifting later entries down. Unlike `splice`, allocates no result array. */
function arrayRemoveAt<T>(arr: T[], index: number): void {
	for (let i = index + 1; i < arr.length; i++) {
		arr[i - 1] = arr[i];
	}

	arr.pop();
}

/**
 * Single `query()` match. One shared class, so each match allocates one
 * object and no bound functions: `key`, `index`, and `delete` are prototype
 * methods, so call them on the result rather than detaching them.
 */
class TrieQueryResult<ItemT> implements QueryResult<TrieElement<ItemT>, ItemT> {
	public readonly element: TrieElement<ItemT>;
	private readonly trie: Trie<ItemT>;
	/** Link id of the matched item when it matched. */
	private readonly linkId: number;
	/** Key of the matched item, kept after the item is removed or replaced. */
	private readonly matchedKey: string | null;

	constructor(trie: Trie<ItemT>, element: TrieElement<ItemT>) {
		this.trie = trie;
		this.element = element;
		this.linkId = element._linkId;
		this.matchedKey = element._key;
	}

	/** Key of the matched item, even after it is removed. */
	public key(): string | null {
		return this.matchedKey;
	}

	/** Always null: a trie orders items by key, not by index. */
	public index(): number | null {
		return null;
	}

	/**
	 * Remove the matched item, but only while the element still holds it.
	 * Removing or replacing the item changes its link id, so a stale result
	 * deletes nothing instead of a later item.
	 */
	public delete(): ItemT | null {
		if (this.element._linkId !== this.linkId) {
			return null;
		}

		return this.trie.removeNode(this.element);
	}
}

/**
 * Trie (prefix tree) mapping string keys to items. Each item's key is read by
 * a caller supplied key selector, and each key is stored as a path of nodes
 * from the root, one node per UTF-16 code unit, so keys sharing a prefix
 * share the nodes for it. The node at the end of a key's path holds its item.
 *
 * Find takes O(k log c) for a key of k code units, where c is the most
 * children any node on the path has (at most 65,536, and usually far fewer).
 * Each node keeps its children in a sorted array, so insert and removal add
 * O(c) when they add or remove a child and shift that array, for O(k log c + c)
 * in all. At most one node per insert or removal can have many children to
 * shift. None of these depend on how many items the trie holds. Prefix
 * searches take O(p log c) to reach the prefix, plus O(log c) per node below
 * it. Every walk is iterative, so long keys never overflow the call stack.
 *
 * Items are kept in key order: ascending by UTF-16 code unit, the order of
 * the `<` operator on strings and of `Array.prototype.sort()` without a
 * comparator. A key comes before every longer key it is a prefix of. Every
 * traversal, the iterator, and `query()` use this order.
 *
 * Node wrappers are pooled by default (see `DataStructureOptions`). The root
 * node belongs to the trie for its lifetime and is never pooled.
 *
 * @remarks
 * Keys are unique. Inserting an item whose key is already stored replaces the
 * stored item, like `Map.prototype.set()`, and keeps the same node. Any query
 * result that matched the replaced item no longer deletes.
 *
 * The trie cannot see changes made to an item after it was inserted. After
 * changing anything the key selector reads, call `update()` so the item is
 * moved to its new key.
 *
 * @category Trie
 */
export class Trie<ItemT> implements DataStructure<ItemT> {
	/** Reads each item's key. Required at construction, fixed for the trie's lifetime. */
	public readonly keySelector: TrieKeySelector<ItemT>;
	/** Node for the empty prefix. Always present; holds the item keyed `''`, if any. */
	private readonly _root: TrieElement<ItemT>;
	private _size: number;
	/** Last id handed to a stored item. Only increases, so ids never repeat. */
	private lastLinkId: number;
	/** Source of node wrappers, pooled or freshly allocated per options. */
	private readonly elements: ElementPool<TrieElement<ItemT>>;
	/** Whether an undefined item is skipped as a no-op or throws. */
	public readonly allowUndefinedItem: boolean;

	/**
	 * @param keySelector	Reads each item's key. Required, since items are
	 * 						generic and the trie cannot find their keys itself.
	 * @param data			Items inserted in array order on creation. Any other
	 * 						input is ignored, as are items without a string key.
	 * 						A later item replaces an earlier one with the same key.
	 * @param options		Optional config. Each option falls back to its default
	 * 						when missing or invalid.
	 * @throws				When keySelector is not a function.
	 */
	constructor(
		keySelector: TrieKeySelector<ItemT>,
		data?: ItemT[] | null,
		options?: TrieOptions<ItemT> | null
	) {
		if (typeof keySelector !== 'function') {
			throw new Error('Trie requires a keySelector function');
		}

		this.keySelector = keySelector;
		this.allowUndefinedItem = booleanValue(true, options?.allowUndefinedItem);
		this._size = 0;
		this.lastLinkId = 0;
		// The element class is generic and the pool builds blank nodes with no
		// value, so any ItemT instantiation is valid here.
		this.elements = new ElementPool(TrieElement as ObjectPoolConstructor<TrieElement<ItemT>>, options);
		this._root = new TrieElement<ItemT>();
		this._root._trie = this;

		if (Array.isArray(data)) {
			this.insertArray(data);
		}
	}

	/**
	 * Iterate items in key order. Each loop creates one iterator; its `next()`
	 * reuses a single result object. `forEach` is the path that allocates
	 * nothing at all.
	 */
	[Symbol.iterator](): TrieIterator<ItemT> {
		return new TrieIterator<ItemT>(this);
	}

	/**
	 * Store item under the key its key selector returns, in O(k log c). Nodes
	 * are created only for the part of the key not already in the trie.
	 * @returns		The node now holding item. When the key was already stored,
	 * 				this is the same node, and the item it held is replaced.
	 * 				`undefined_item` when item is undefined (throws instead when
	 * 				`allowUndefinedItem` is `false`; the key selector is never
	 * 				called). `invalid_key` when the key selector does not return
	 * 				a string. Nothing is added in either case.
	 */
	public insert(item: ItemT): TrieElement<ItemT> | TrieError {
		if (undefinedItemSkip(item, this.allowUndefinedItem, 'Trie')) {
			return 'undefined_item';
		}

		const key = this.keySelector(item);

		if (typeof key !== 'string') {
			return 'invalid_key';
		}

		return this.store(item, key);
	}

	/**
	 * Insert each provided item, in array order. Items without a string key are
	 * skipped, and a later item replaces an earlier one with the same key.
	 */
	public insertArray(items?: ItemT[] | null): void {
		if (!Array.isArray(items)) {
			return;
		}

		for (let i = 0; i < items.length; i++) {
			this.insert(items[i]);
		}
	}

	/**
	 * Find the node holding the item stored under exactly key, in O(k log c).
	 * @returns		Matching node, or null when no item has that key or key is
	 * 				not a string.
	 */
	public find(key: string): TrieElement<ItemT> | null {
		const node = this.walk(key);

		return node !== null && node._terminal ? node : null;
	}

	/**
	 * Item stored under exactly key, like `Map.prototype.get()`.
	 * @returns		The item, or null when no item has that key or key is not a
	 * 				string.
	 */
	public get(key: string): ItemT | null {
		const node = this.find(key);

		return node !== null ? node._value : null;
	}

	/**
	 * Check whether an item is stored under exactly key.
	 */
	public contains(key: string): boolean {
		return this.find(key) !== null;
	}

	/**
	 * Check whether any stored key starts with prefix, in O(p log c). Every key
	 * starts with `''`, so an empty prefix is true whenever the trie is not
	 * empty.
	 * @returns		True when at least one key starts with prefix. False when
	 * 				none does or prefix is not a string.
	 */
	public hasPrefix(prefix: string): boolean {
		const node = this.walk(prefix);

		// Every node other than the root leads to at least one stored key.
		return node !== null && (node !== this._root || this._size > 0);
	}

	/**
	 * Node holding the item with the longest key that is a prefix of text, in
	 * O(k log c) for a text of k code units. Useful for tokenizing and routing,
	 * e.g. matching the longest known word at the start of some input.
	 * @returns		Matching node, or null when no key is a prefix of text or text
	 * 				is not a string.
	 */
	public longestPrefixOf(text: string): TrieElement<ItemT> | null {
		if (typeof text !== 'string') {
			return null;
		}

		let node: TrieElement<ItemT> | null = this._root;
		let match: TrieElement<ItemT> | null = node._terminal ? node : null;

		for (let i = 0; i < text.length && node !== null; i++) {
			node = this.childOf(node, text.charCodeAt(i));

			if (node !== null && node._terminal) {
				match = node;
			}
		}

		return match;
	}

	/**
	 * Remove the item stored under exactly key, like `Map.prototype.delete()`,
	 * but returning the item.
	 * @returns		The removed item, or null when no item has that key or key is
	 * 				not a string.
	 */
	public remove(key: string): ItemT | null {
		return this.removeNode(this.find(key));
	}

	/**
	 * Remove the item node holds and return it, in O(k log c) for the node's
	 * key of k code units. Nodes left leading to no other key are unlinked
	 * and, with pooling on, recycled: this includes node itself unless longer
	 * keys pass through it. Either way node must not be used afterwards.
	 * @returns		The removed item, or null when node is null, holds no item,
	 * 				or is not part of this trie (including a node whose item was
	 * 				already removed).
	 */
	public removeNode(node: TrieElement<ItemT> | null): ItemT | null {
		if (!node || !this.isStored(node)) {
			return null;
		}

		const value = node._value as ItemT;

		this.unstore(node);
		this._size--;

		return value;
	}

	/**
	 * Set node's item and keep it under the right key. For an item changed in
	 * place, pass the node's own item: `trie.update(node, node.value())`. When
	 * the key is unchanged, node keeps item and nothing moves. Otherwise node's
	 * item is removed as in `removeNode()` and item is inserted under its new
	 * key, replacing any item already stored there.
	 *
	 * @remarks
	 * A node stands for a key, so an item under a new key is held by a
	 * different node. When the key changes, use the returned node from then on.
	 * Whether or not the key changes, item is stored as a fresh insert, so
	 * query results that matched node no longer delete.
	 *
	 * @returns		The node now holding item: node itself when the key is
	 * 				unchanged. `undefined_item` when item is undefined (throws
	 * 				instead when `allowUndefinedItem` is `false`; the key
	 * 				selector is never called and node keeps its item).
	 * 				`invalid_key` when the key selector does not return
	 * 				a string for item: node's item is removed and item is not
	 * 				added. Null when node is null, holds no item, or is not part
	 * 				of this trie; nothing changes then.
	 */
	public update(node: TrieElement<ItemT> | null, item: ItemT): TrieElement<ItemT> | TrieError | null {
		if (undefinedItemSkip(item, this.allowUndefinedItem, 'Trie')) {
			return 'undefined_item';
		}

		if (!node || !this.isStored(node)) {
			return null;
		}

		const key = this.keySelector(item);

		if (typeof key !== 'string') {
			this.removeNode(node);
			return 'invalid_key';
		}

		if (key === node._key) {
			node._value = item;
			// A replacement gets a fresh link id, exactly as insert() on the
			// same key would, so stale query results delete nothing.
			node._linkId = ++this.lastLinkId;
			return node;
		}

		this.removeNode(node);

		return this.store(item, key);
	}

	/**
	 * Node for the empty prefix, from which every key's path starts. Always
	 * present, even when the trie is empty. It holds an item only when one is
	 * keyed `''`.
	 */
	public root(): TrieElement<ItemT> {
		return this._root;
	}

	/**
	 * Node holding the item with the first key in key order.
	 * @returns		First node, or null when the trie is empty.
	 */
	public min(): TrieElement<ItemT> | null {
		return this.firstTerminal(this._root);
	}

	/**
	 * Node holding the item with the last key in key order, found in O(k) by
	 * following last children down to a leaf.
	 * @returns		Last node, or null when the trie is empty.
	 */
	public max(): TrieElement<ItemT> | null {
		if (this._size === 0) {
			return null;
		}

		return this.lastDescendant(this._root);
	}

	/**
	 * Node after node in key order.
	 * @returns		Next node, or null when node is the last, is null, holds no
	 * 				item, or is not part of this trie.
	 */
	public successor(node: TrieElement<ItemT> | null): TrieElement<ItemT> | null {
		if (!node || !this.isStored(node)) {
			return null;
		}

		return this.nextTerminal(node, this._root);
	}

	/**
	 * Node before node in key order.
	 * @returns		Previous node, or null when node is the first, is null, holds
	 * 				no item, or is not part of this trie.
	 */
	public predecessor(node: TrieElement<ItemT> | null): TrieElement<ItemT> | null {
		if (!node || !this.isStored(node)) {
			return null;
		}

		let curr = node;

		while (curr !== this._root) {
			const parent = curr._parent as TrieElement<ItemT>;
			const index = trieCodeSearch(parent._codes, curr._code);

			// The previous sibling's subtree comes just before curr's, and its
			// last node is the deepest along last children.
			if (index > 0) {
				return this.lastDescendant(parent._children[index - 1]);
			}

			// A parent comes before its first child.
			if (parent._terminal) {
				return parent;
			}

			curr = parent;
		}

		return null;
	}

	/**
	 * Nodes holding items whose keys start with prefix, in key order. Shares
	 * its walk with `forEachWithPrefix()`, so both find the same nodes in the
	 * same order.
	 * @param out	Optional array to fill instead of allocating a new one. Its
	 * 				previous contents are replaced and its length set to the
	 * 				match count. The array object is reused, but V8 shrinks its
	 * 				storage when the length drops, so a later call with more
	 * 				matches can allocate storage again. For zero allocation use
	 * 				`forEachWithPrefix()`.
	 * @returns		out when given, otherwise a new array, holding the matching
	 * 				nodes. Empty when prefix is not a string.
	 */
	public withPrefix(prefix: string, out?: TrieElement<ItemT>[] | null): TrieElement<ItemT>[] {
		return this.collect(prefix, out, trieNodeOf);
	}

	/**
	 * Keys starting with prefix, in key order: the autocomplete query.
	 * @param out	Optional array to fill instead of allocating a new one, as in
	 * 				`withPrefix()`.
	 * @returns		out when given, otherwise a new array, holding the matching
	 * 				keys. Empty when prefix is not a string.
	 */
	public keysWithPrefix(prefix: string, out?: string[] | null): string[] {
		return this.collect(prefix, out, trieKeyOf);
	}

	/**
	 * Call func once for each node holding an item whose key starts with
	 * prefix, in key order. The zero-allocation form of `withPrefix()`. Visits
	 * nothing when no key starts with prefix or prefix is not a string.
	 *
	 * @remarks
	 * Each node's successor is found before func runs, and the walk re-finds
	 * its place by key when func removes or replaces that successor, so func
	 * may remove or replace any items, not just the current one. Items
	 * inserted during the walk may or may not be visited.
	 *
	 * @param func		Called with (element, index, trie). index counts visited
	 * 					items from 0.
	 * @param thisArg	Value used as `this` when calling func, as passed. Like
	 * 					`Array.prototype.forEach`, `this` is undefined when omitted.
	 * @returns			This trie, like `forEach()`.
	 */
	public forEachWithPrefix(prefix: string, func: TrieMethod<ItemT, void>, thisArg?: unknown): Trie<ItemT> {
		const start = this.walk(prefix);

		if (start !== null) {
			this.visit(start, prefix, func, thisArg);
		}

		return this;
	}

	/**
	 * Get number of items in the trie.
	 * @returns		Trie size as a positive integer, or 0 if empty.
	 */
	public size(): number {
		return this._size;
	}

	/**
	 * Quickly check whether the trie has items.
	 */
	public isEmpty(): boolean {
		return this._size === 0;
	}

	/**
	 * Create a new trie containing only the items of elements for which func
	 * returns true. The new trie uses this trie's key selector and options.
	 * @param func		Called with (element, index, trie) in key order.
	 * @param thisArg	Value used as `this` when calling func, as passed. Like
	 * 					`Array.prototype.filter`, `this` is undefined when omitted.
	 */
	public filter(func: TrieMethod<ItemT, boolean>, thisArg?: unknown): Trie<ItemT> {
		return new Trie<ItemT>(this.keySelector, this.filterValues(func, thisArg), this.options());
	}

	/**
	 * Items of elements for which func returns true, in key order. Subclasses
	 * build their own `filter()` result from this.
	 */
	protected filterValues(func: TrieMethod<ItemT, boolean>, thisArg?: unknown): ItemT[] {
		const values: ItemT[] = [];

		this.forEach((elem, idx, trie) => {
			if (func.call(thisArg, elem, idx, trie)) {
				values.push(elem._value as ItemT);
			}
		});

		return values;
	}

	/**
	 * Options equivalent to the ones this trie was built with, for creating
	 * derived tries that behave the same way.
	 */
	protected options(): TrieOptions<ItemT> {
		return {...this.elements.options(), allowUndefinedItem: this.allowUndefinedItem};
	}

	/**
	 * Call func for each node holding an item, in key order, by following
	 * successor links. No array of elements is built, so the traversal itself
	 * allocates nothing.
	 *
	 * @remarks
	 * Like `Map` / `Set`, func receives the trie itself as its third argument,
	 * not an array. Each element's successor is found before func runs, and
	 * the walk re-finds its place by key when func removes or replaces that
	 * successor, so func may remove or replace any elements, not just the
	 * current one. Elements inserted during the walk may or may not be
	 * visited.
	 *
	 * @param func		Called with (element, index, trie) in key order.
	 * @param thisArg	Value used as `this` when calling func, as passed. Like
	 * 					`Array.prototype.forEach`, `this` is undefined when omitted.
	 */
	public forEach(func: TrieMethod<ItemT, void>, thisArg?: unknown): Trie<ItemT> {
		this.visit(this._root, '', func, thisArg);

		return this;
	}

	/**
	 * Every stored key, in key order.
	 */
	public keys(): string[] {
		return this.keysWithPrefix('');
	}

	/**
	 * Every item, in key order.
	 * @param out	Optional array to fill instead of allocating a new one, as
	 * 				in `withPrefix()`.
	 */
	public values(out?: ItemT[] | null): ItemT[] {
		return this.collect('', out, trieValueOf);
	}

	/**
	 * Serialize trie items, in key order, to a JSON string.
	 * @returns		JSON string, or null when an item cannot be serialized
	 * 				(e.g. items contain circular references or BigInt values).
	 */
	public stringify(): string | null {
		try {
			return JSON.stringify({type: 'Trie', elements: this.values()});
		} catch {
			return null;
		}
	}

	/**
	 * Every node holding an item, in key order.
	 */
	public toArray(): TrieElement<ItemT>[] {
		return this.withPrefix('');
	}

	/**
	 * Find elements whose items pass every filter, in key order. Each result's
	 * `key()` returns the matched item's key. Its `delete()` removes the
	 * element's item, and does nothing once that item has been removed or
	 * replaced some other way.
	 *
	 * @remarks
	 * Allocates only the returned array and one result per match. Elements
	 * that do not match allocate nothing. A result's `key`, `index`, and
	 * `delete` are prototype methods: call them on the result, e.g.
	 * `result.delete()`, rather than detaching them.
	 */
	public query(
		filters: QueryFilter<ItemT> | QueryFilter<ItemT>[],
		opts?: QueryOptions
	): QueryResult<TrieElement<ItemT>, ItemT>[] {
		const resultsArray: QueryResult<TrieElement<ItemT>, ItemT>[] = [];
		const limit = this.queryLimit(opts);
		let node = this.min();

		// Stops walking as soon as the limit is reached.
		while (node !== null && resultsArray.length < limit) {
			const element = node;
			node = this.nextTerminal(element, this._root);

			if (!this.queryMatch(filters, element._value as ItemT)) {
				continue;
			}

			resultsArray.push(new TrieQueryResult(this, element));
		}

		return resultsArray;
	}

	/**
	 * Remove every item and unlink and drop every node except the root.
	 * Nodes removed this way are blanked, and are recycled when pooling is on.
	 */
	public clearElements(): Trie<ItemT> {
		const root = this._root;
		let node = root;

		// Walks down last children to a leaf, cuts it from its parent, drops it,
		// and resumes from the parent. Cutting the last child is O(1), so the
		// whole clear is O(n) and builds no array.
		while (node !== root || node._children.length > 0) {
			if (node._children.length > 0) {
				node = node._children[node._children.length - 1];
				continue;
			}

			const parent = node._parent as TrieElement<ItemT>;
			parent._codes.pop();
			parent._children.pop();
			this.drop(node);
			node = parent;
		}

		root._value = null;
		root._key = null;
		root._terminal = false;
		root._linkId = 0;
		this._size = 0;

		return this;
	}

	/**
	 * Restore the trie to its freshly constructed state. The key selector and
	 * constructor options are kept.
	 */
	public reset(): Trie<ItemT> {
		this.clearElements();

		return this;
	}

	/**
	 * Store item under key, creating any missing nodes on key's path, and give
	 * the item a fresh link id.
	 */
	private store(item: ItemT, key: string): TrieElement<ItemT> {
		let node = this._root;

		for (let i = 0; i < key.length; i++) {
			node = this.childOrCreate(node, key.charCodeAt(i));
		}

		if (!node._terminal) {
			node._terminal = true;
			++this._size;
		}

		node._value = item;
		node._key = key;
		node._linkId = ++this.lastLinkId;

		return node;
	}

	/**
	 * Clear the item node holds, then unlink and drop node and each ancestor
	 * left holding no item and leading to no key. The root is never dropped.
	 * Does not change the size.
	 */
	private unstore(node: TrieElement<ItemT>): void {
		node._value = null;
		node._key = null;
		node._terminal = false;
		node._linkId = 0;

		let curr = node;

		while (curr !== this._root && !curr._terminal && curr._children.length === 0) {
			const parent = curr._parent as TrieElement<ItemT>;
			const index = trieCodeSearch(parent._codes, curr._code);

			arrayRemoveAt(parent._codes, index);
			arrayRemoveAt(parent._children, index);
			this.drop(curr);
			curr = parent;
		}
	}

	/**
	 * Node for key's full path, whether or not it holds an item.
	 * @returns		The node, or null when no stored key starts with key (or it
	 * 				is only the empty trie's root) or key is not a string.
	 */
	private walk(key: string): TrieElement<ItemT> | null {
		if (typeof key !== 'string') {
			return null;
		}

		let node: TrieElement<ItemT> | null = this._root;

		for (let i = 0; i < key.length && node !== null; i++) {
			node = this.childOf(node, key.charCodeAt(i));
		}

		return node;
	}

	/**
	 * Fill out (or a new array) with pick of every node holding an item whose
	 * key starts with prefix, in key order. The one walk behind
	 * `withPrefix()`, `keysWithPrefix()`, and `values()`.
	 */
	private collect<OutT>(
		prefix: string,
		out: OutT[] | null | undefined,
		pick: (node: TrieElement<ItemT>) => OutT
	): OutT[] {
		const result: OutT[] = Array.isArray(out) ? out : [];
		const start = this.walk(prefix);
		let count = 0;

		if (start !== null) {
			let node = this.firstTerminal(start);

			while (node !== null) {
				result[count++] = pick(node);
				node = this.nextTerminal(node, start);
			}
		}

		result.length = count;

		return result;
	}

	private childOf(node: TrieElement<ItemT>, code: number): TrieElement<ItemT> | null {
		const index = trieCodeSearch(node._codes, code);

		return index >= 0 ? node._children[index] : null;
	}

	/**
	 * Child of parent reached by code, linked in code order from the element
	 * pool when parent has none yet.
	 */
	private childOrCreate(parent: TrieElement<ItemT>, code: number): TrieElement<ItemT> {
		const index = trieCodeSearch(parent._codes, code);

		if (index >= 0) {
			return parent._children[index];
		}

		const slot = -index - 1;
		const child = this.elements.allocate();
		child._code = code;
		child._parent = parent;
		child._trie = this;

		arrayInsertAt(parent._codes, slot, code);
		arrayInsertAt(parent._children, slot, child);

		return child;
	}

	/**
	 * Node after node in a pre-order walk of limit's subtree, which visits
	 * children in code order and so visits keys in key order.
	 * @returns		Next node, or null when node is the last in limit's subtree.
	 */
	private preOrderNext(node: TrieElement<ItemT>, limit: TrieElement<ItemT>): TrieElement<ItemT> | null {
		if (node._children.length > 0) {
			return node._children[0];
		}

		return this.afterSubtree(node, limit);
	}

	/**
	 * First node after node's whole subtree in a pre-order walk of limit's
	 * subtree: the next sibling of node or of its nearest ancestor with one.
	 * @returns		That node, or null when nothing follows node's subtree.
	 */
	private afterSubtree(node: TrieElement<ItemT>, limit: TrieElement<ItemT>): TrieElement<ItemT> | null {
		let curr = node;

		while (curr !== limit) {
			const parent = curr._parent;

			if (parent === null) {
				return null;
			}

			const next = trieCodeSearch(parent._codes, curr._code) + 1;

			if (next < parent._children.length) {
				return parent._children[next];
			}

			curr = parent;
		}

		return null;
	}

	/**
	 * First node holding an item whose key is at or after key in key order,
	 * within start's subtree. key's first offset code units spell start's own
	 * path. Used by `visit()` to re-find its place after func changes the trie.
	 */
	private terminalAtOrAfter(
		key: string,
		offset: number,
		start: TrieElement<ItemT>
	): TrieElement<ItemT> | null {
		let node = start;

		for (let i = offset; i < key.length; i++) {
			const index = trieCodeSearch(node._codes, key.charCodeAt(i));

			if (index >= 0) {
				node = node._children[index];
				continue;
			}

			// key's path ends here: children from the insertion point on lead
			// only to keys after key, and earlier siblings only to keys before it.
			const slot = -index - 1;
			const from = slot < node._children.length ? node._children[slot] : this.afterSubtree(node, start);

			return from !== null ? this.firstTerminal(from) : null;
		}

		return this.firstTerminal(node);
	}

	/**
	 * First node holding an item in pre-order of start's subtree, start itself
	 * included.
	 */
	private firstTerminal(start: TrieElement<ItemT>): TrieElement<ItemT> | null {
		return start._terminal ? start : this.nextTerminal(start, start);
	}

	/**
	 * Next node holding an item after node, in pre-order of limit's subtree.
	 */
	private nextTerminal(node: TrieElement<ItemT>, limit: TrieElement<ItemT>): TrieElement<ItemT> | null {
		let curr = this.preOrderNext(node, limit);

		while (curr !== null && !curr._terminal) {
			curr = this.preOrderNext(curr, limit);
		}

		return curr;
	}

	/**
	 * Last node in pre-order of node's subtree: the leaf reached by following
	 * last children. Every leaf other than the root holds an item.
	 */
	private lastDescendant(node: TrieElement<ItemT>): TrieElement<ItemT> {
		let curr = node;

		while (curr._children.length > 0) {
			curr = curr._children[curr._children.length - 1];
		}

		return curr;
	}

	/**
	 * Call func for each node holding an item in start's subtree, in key
	 * order. start is the node at prefix's path. The next node, its key, and
	 * its link id are captured before func runs, so func may change the trie
	 * freely: when the captured node's item is removed or replaced, or its
	 * node is pruned or even recycled elsewhere in the trie, the walk
	 * re-finds its place from the captured key and continues with the first
	 * stored key at or after it.
	 */
	private visit(
		start: TrieElement<ItemT>,
		prefix: string,
		func: TrieMethod<ItemT, void>,
		thisArg?: unknown
	): void {
		let limit: TrieElement<ItemT> | null = start;
		let node = this.firstTerminal(start);
		let index = 0;

		while (node !== null && limit !== null) {
			const next = this.nextTerminal(node, limit);
			// Link ids are never reused, so an unchanged id proves next was
			// untouched. Its key is kept to re-find the place otherwise.
			const nextKey = next !== null ? (next._key as string) : '';
			const nextLinkId = next !== null ? next._linkId : 0;

			func.call(thisArg, node, index, this);
			index++;

			if (next === null || (next._trie === this && next._linkId === nextLinkId)) {
				node = next;
				continue;
			}

			// func removed, replaced, or moved next's item, and next or even
			// limit may have been pruned and recycled. Re-walk both by key.
			limit = this.walk(prefix);
			node = limit !== null ? this.terminalAtOrAfter(nextKey, prefix.length, limit) : null;
		}
	}

	/**
	 * Drop a node that has left the trie: blank its item, links, and
	 * ownership, and recycle it when pooling is on. The pool blanks the nodes
	 * it takes back; with pooling off the node is blanked here. Either way a
	 * removed node the caller still holds never keeps its item alive. Callers
	 * read any value they return before dropping.
	 */
	private drop(node: TrieElement<ItemT>): void {
		if (this.elements.enabled()) {
			this.elements.release(node);
		} else {
			node.cleanObj();
		}
	}

	/** Whether node is linked into this trie and holds an item. */
	private isStored(node: TrieElement<ItemT>): boolean {
		return node._trie === this && node._terminal;
	}

	/**
	 * Whether value passes every filter. An empty filter array matches
	 * nothing. Plain loop, so no closure is created per element.
	 */
	private queryMatch(filters: QueryFilter<ItemT> | QueryFilter<ItemT>[], value: ItemT): boolean {
		if (!Array.isArray(filters)) {
			return filters(value);
		}

		if (filters.length === 0) {
			return false;
		}

		for (let i = 0; i < filters.length; i++) {
			if (!filters[i](value)) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Maximum number of query results: opts.limit rounded when it is a number
	 * of at least 1, otherwise unlimited.
	 */
	private queryLimit(opts?: QueryOptions): number {
		const limit = opts?.limit;

		if (limit && isNumber(limit) && limit >= 1) {
			return Math.round(limit);
		}

		return Infinity;
	}
}
