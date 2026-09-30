import {ObjectPool} from '../src/object/pool';
import {Trie} from '../src/trie';
import {TrieElement} from '../src/trie/element';
import {TrieIterator} from '../src/trie/iterator';

interface Entry {
	k: string;
	v: number;
}

const byWord = (word: string): string => word;
const byK = (entry: Entry): string => entry.k;
const poolOf = (target: Trie<any>): ObjectPool<any> | null => (target as any).elements.objectPool;

/**
 * Walk the whole trie and check every structural rule: child codes are sorted
 * and parallel to children, links agree both ways, every node is owned by the
 * trie, every non-root leaf holds an item, each stored key spells the node's
 * path, only stored nodes carry a value and link id, and size matches the
 * stored node count.
 */
const expectValid = <T>(trie: Trie<T>): void => {
	const root = trie.root();
	const stack: {node: TrieElement<T>; path: string}[] = [{node: root, path: ''}];
	let count = 0;

	expect(root.parent()).toBeNull();

	while (stack.length) {
		const {node, path} = stack.pop()!;

		expect(node._trie).toBe(trie);
		expect(node._codes.length).toBe(node._children.length);

		if (node !== root) {
			expect(node.isLeaf() ? node._terminal : true).toBe(true);
		}

		if (node._terminal) {
			count++;
			expect(node._key).toBe(path);
			expect(node._linkId).toBeGreaterThan(0);
		} else {
			expect(node._key).toBeNull();
			expect(node._value).toBeNull();
			expect(node._linkId).toBe(0);
		}

		for (let i = 0; i < node._children.length; i++) {
			const child = node._children[i];

			if (i > 0) {
				expect(node._codes[i - 1]).toBeLessThan(node._codes[i]);
			}

			expect(child._code).toBe(node._codes[i]);
			expect(child._parent).toBe(node);
			stack.push({node: child, path: path + String.fromCharCode(child._code)});
		}
	}

	expect(trie.size()).toBe(count);
};

/** Number of nodes linked into trie, root included. */
const nodeCount = (trie: Trie<any>): number => {
	const stack: TrieElement<any>[] = [trie.root()];
	let count = 0;

	while (stack.length) {
		const node = stack.pop()!;
		count++;
		stack.push(...node._children);
	}

	return count;
};

const trie = new Trie<string>(byWord);

describe('Trie', () => {
	beforeEach(() => {
		trie.reset();
		expect(trie.isEmpty()).toBe(true);
	});

	describe('INSTANTIATION', () => {
		it('with only a key selector', () => {
			const result = new Trie<string>(byWord);

			expect(result).toBeInstanceOf(Trie);
			expect(result.size()).toBe(0);
			expect(result.keySelector).toBe(byWord);
			expect(result.root()).toBeInstanceOf(TrieElement);
			expect(result.root().isLeaf()).toBe(true);
			expect(result.root().isTerminal()).toBe(false);
		});

		it('with items inserted in array order', () => {
			const result = new Trie<string>(byWord, ['tea', 'ten', 'to']);

			expect(result.size()).toBe(3);
			expect(result.keys()).toEqual(['tea', 'ten', 'to']);
			expect(result.root().children().length).toBe(1);
			expectValid(result);
		});

		it('keeps the later of two items with the same key', () => {
			const result = new Trie<Entry>(byK, [
				{k: 'a', v: 1},
				{k: 'a', v: 2}
			]);

			expect(result.size()).toBe(1);
			expect(result.get('a')?.v).toBe(2);
		});

		it('does not keep a reference to the provided array', () => {
			const items = ['a', 'b'];
			const result = new Trie<string>(byWord, items);
			items.push('c');

			expect(result.size()).toBe(2);
		});

		it('throws without a key selector function', () => {
			expect(() => new Trie<string>(undefined as any)).toThrow();
			expect(() => new Trie<string>(null as any)).toThrow();
			expect(() => new Trie<string>({} as any)).toThrow();
		});

		it('ignores invalid data and options instead of throwing', () => {
			expect(new Trie(byWord, 'adsf' as any).size()).toBe(0);
			expect(new Trie(byWord, null).size()).toBe(0);
			expect(new Trie(byWord, {elements: ['a']} as any).size()).toBe(0);
			expect(new Trie(byWord, ['a'], null).size()).toBe(1);
			expect(new Trie(byWord, ['a'], 'nope' as any).size()).toBe(1);
		});

		it('skips items without a string key', () => {
			const result = new Trie<any>(byWord, ['a', 4, null, undefined, {}, 'b']);

			expect(result.keys()).toEqual(['a', 'b']);
		});
	});

	describe('ELEMENT POOLING', () => {
		it('is enabled by default', () => {
			expect(poolOf(new Trie(byWord))).toBeInstanceOf(ObjectPool);
		});

		it('only strict true disables it', () => {
			expect(poolOf(new Trie(byWord, [], {disableElementPooling: true}))).toBeNull();
			expect(poolOf(new Trie(byWord, [], {disableElementPooling: 'true' as any}))).toBeInstanceOf(
				ObjectPool
			);
		});

		it('recycles removed nodes for later inserts', () => {
			const pooled = new Trie<string>(byWord);
			const first = pooled.insert('ab') as TrieElement<string>;
			const parent = first.parent()!;
			pooled.remove('ab');
			const second = pooled.insert('cd') as TrieElement<string>;

			// Nodes are released leaf first, and the pool reissues the latest release.
			expect(second.parent()).toBe(parent);
			expect(second).toBe(first);
			expectValid(pooled);
		});

		it('never pools the root', () => {
			const pooled = new Trie<string>(byWord, ['a', 'b']);
			pooled.clearElements();

			expect(poolOf(pooled)!.size()).toBe(0);
			expect(pooled.root()._trie).toBe(pooled);
		});

		it('steady-state inserts and removals reuse the same nodes', () => {
			const pooled = new Trie<string>(byWord);
			const words = ['alpha', 'alps', 'beta', 'bet'];

			pooled.insertArray(words);
			words.forEach((w) => pooled.remove(w));
			const pool = poolOf(pooled)!;
			const capacity = pool.state.objectCount;

			for (let i = 0; i < 20; i++) {
				pooled.insertArray(words);
				words.forEach((w) => pooled.remove(w));
			}

			expect(pool.state.objectCount).toBe(capacity);
			expect(nodeCount(pooled)).toBe(1);
		});

		it('blanks removed nodes when pooling is disabled', () => {
			const plain = new Trie<string>(byWord, [], {disableElementPooling: true});
			const node = plain.insert('ab') as TrieElement<string>;
			plain.remove('ab');

			expect(node).toEqual(new TrieElement<string>());
		});
	});

	describe('insert', () => {
		it('returns the node holding the item', () => {
			const node = trie.insert('car') as TrieElement<string>;

			expect(node).toBeInstanceOf(TrieElement);
			expect(node.value()).toBe('car');
			expect(node.key()).toBe('car');
			expect(node.isTerminal()).toBe(true);
			expect(trie.size()).toBe(1);
			expectValid(trie);
		});

		it('shares nodes for shared prefixes', () => {
			trie.insertArray(['car', 'cart', 'care', 'cat']);

			// root, c, a, r, t, e, t
			expect(nodeCount(trie)).toBe(7);
			expect(trie.find('car')!.children().length).toBe(2);
			expectValid(trie);
		});

		it('stores a key that is a prefix of a stored key on its existing node', () => {
			const long = trie.insert('cart') as TrieElement<string>;
			const short = trie.insert('car') as TrieElement<string>;

			expect(long.parent()).toBe(short);
			expect(trie.size()).toBe(2);
			expect(nodeCount(trie)).toBe(5);
			expectValid(trie);
		});

		it('stores the empty key on the root', () => {
			const node = trie.insert('');

			expect(node).toBe(trie.root());
			expect(trie.contains('')).toBe(true);
			expect(trie.size()).toBe(1);
			expectValid(trie);
		});

		it('replaces the item under an existing key and keeps the node', () => {
			const entries = new Trie<Entry>(byK);
			const first = entries.insert({k: 'x', v: 1});
			const second = entries.insert({k: 'x', v: 2});

			expect(second).toBe(first);
			expect(entries.size()).toBe(1);
			expect(entries.get('x')?.v).toBe(2);
			expectValid(entries);
		});

		it('insertArray ignores anything but an array', () => {
			trie.insertArray(null);
			trie.insertArray(undefined);
			trie.insertArray('abc' as any);

			expect(trie.size()).toBe(0);
		});

		it('refuses items without a string key', () => {
			const any = new Trie<any>(byWord);

			expect(any.insert(5)).toBe('invalid_key');
			expect(any.insert(null)).toBe('invalid_key');
			expect(any.insert(undefined)).toBe('undefined_item');
			expect(any.size()).toBe(0);
			expect(nodeCount(any)).toBe(1);
		});

		it('keeps a null item under a valid key and never stores undefined', () => {
			const entries = new Trie<Entry | null | undefined>(() => 'k');

			entries.insert(null);
			expect(entries.contains('k')).toBe(true);
			expect(entries.get('k')).toBeNull();

			// Skipped as a no-op: the stored null item is untouched.
			expect(entries.insert(undefined)).toBe('undefined_item');
			expect(entries.get('k')).toBeNull();
			expect(entries.size()).toBe(1);
		});

		it('orders children by UTF-16 code unit', () => {
			trie.insertArray(['b', 'B', 'a', '', 'é', '😀', 'Z', '1']);

			expect(trie.keys()).toEqual(['', '1', 'B', 'Z', 'a', 'b', 'é', '😀']);
			expect(trie.keys()).toEqual(trie.keys().slice().sort());
			expectValid(trie);
		});

		it('handles keys split across surrogate pairs', () => {
			trie.insertArray(['😀', '😁', '\uD83D']);

			expect(trie.size()).toBe(3);
			expect(trie.contains('😀')).toBe(true);
			expect(trie.contains('\uD83D')).toBe(true);
			expect(trie.find('\uD83D')!.children().length).toBe(2);
			expectValid(trie);
		});

		it('handles long keys without recursion', () => {
			const long = 'x'.repeat(50000);
			trie.insert(long);
			trie.insert(long + 'y');

			expect(trie.contains(long)).toBe(true);
			expect(trie.keysWithPrefix(long).length).toBe(2);
			expect(trie.max()!.key()).toBe(long + 'y');
			expect(trie.predecessor(trie.max())!.key()).toBe(long);

			trie.clearElements();
			expect(nodeCount(trie)).toBe(1);
		});
	});

	describe('find / get / contains', () => {
		beforeEach(() => {
			trie.insertArray(['car', 'cart', 'cat']);
		});

		it('finds only whole keys', () => {
			expect(trie.find('car')?.value()).toBe('car');
			expect(trie.find('ca')).toBeNull();
			expect(trie.find('cars')).toBeNull();
			expect(trie.find('')).toBeNull();
			expect(trie.contains('cart')).toBe(true);
			expect(trie.contains('c')).toBe(false);
			expect(trie.get('cat')).toBe('cat');
			expect(trie.get('dog')).toBeNull();
		});

		it('returns null for non-string keys', () => {
			expect(trie.find(null as any)).toBeNull();
			expect(trie.find(5 as any)).toBeNull();
			expect(trie.get(undefined as any)).toBeNull();
			expect(trie.contains({} as any)).toBe(false);
		});
	});

	describe('hasPrefix', () => {
		it('checks whether any key starts with prefix', () => {
			trie.insertArray(['car', 'cat']);

			expect(trie.hasPrefix('c')).toBe(true);
			expect(trie.hasPrefix('ca')).toBe(true);
			expect(trie.hasPrefix('car')).toBe(true);
			expect(trie.hasPrefix('cars')).toBe(false);
			expect(trie.hasPrefix('d')).toBe(false);
			expect(trie.hasPrefix(7 as any)).toBe(false);
		});

		it('is true for the empty prefix only when not empty', () => {
			expect(trie.hasPrefix('')).toBe(false);
			trie.insert('a');
			expect(trie.hasPrefix('')).toBe(true);
			trie.remove('a');
			expect(trie.hasPrefix('')).toBe(false);
		});
	});

	describe('longestPrefixOf', () => {
		it('returns the node of the longest key that prefixes the text', () => {
			trie.insertArray(['she', 'shells', 'sea']);

			expect(trie.longestPrefixOf('shell')?.key()).toBe('she');
			expect(trie.longestPrefixOf('shellsort')?.key()).toBe('shells');
			expect(trie.longestPrefixOf('she')?.key()).toBe('she');
			expect(trie.longestPrefixOf('sh')).toBeNull();
			expect(trie.longestPrefixOf('')).toBeNull();
			expect(trie.longestPrefixOf(null as any)).toBeNull();
		});

		it('matches the empty key for any text', () => {
			trie.insert('');

			expect(trie.longestPrefixOf('anything')).toBe(trie.root());
			expect(trie.longestPrefixOf('')).toBe(trie.root());
		});
	});

	describe('remove / removeNode', () => {
		it('removes by key and returns the item', () => {
			trie.insertArray(['car', 'cat']);

			expect(trie.remove('car')).toBe('car');
			expect(trie.contains('car')).toBe(false);
			expect(trie.size()).toBe(1);
			expectValid(trie);
		});

		it('returns null when the key is not stored', () => {
			trie.insert('car');

			expect(trie.remove('ca')).toBeNull();
			expect(trie.remove('cars')).toBeNull();
			expect(trie.remove(3 as any)).toBeNull();
			expect(trie.size()).toBe(1);
		});

		it('prunes nodes that no longer lead to a key', () => {
			trie.insertArray(['car', 'cartoon']);
			trie.remove('cartoon');

			expect(nodeCount(trie)).toBe(4);
			expect(trie.find('car')!.isLeaf()).toBe(true);
			expectValid(trie);

			trie.remove('car');
			expect(nodeCount(trie)).toBe(1);
			expect(trie.root().isLeaf()).toBe(true);
		});

		it('keeps a node that longer keys pass through', () => {
			const car = trie.insert('car') as TrieElement<string>;
			trie.insert('cart');
			trie.remove('car');

			expect(car._trie).toBe(trie);
			expect(car.isTerminal()).toBe(false);
			expect(car.value()).toBeNull();
			expect(car.key()).toBeNull();
			expect(trie.contains('cart')).toBe(true);
			expectValid(trie);
		});

		it('stops pruning at a node holding another item', () => {
			trie.insertArray(['a', 'abc']);
			trie.remove('abc');

			expect(nodeCount(trie)).toBe(2);
			expectValid(trie);
		});

		it('removes the empty key from the root without dropping it', () => {
			trie.insertArray(['', 'a']);

			expect(trie.remove('')).toBe('');
			expect(trie.root()._trie).toBe(trie);
			expect(trie.keys()).toEqual(['a']);
			expectValid(trie);
		});

		it('removeNode returns null for nodes it does not hold items for', () => {
			trie.insert('ab');
			const other = new Trie<string>(byWord, ['ab']);

			expect(trie.removeNode(null)).toBeNull();
			expect(trie.removeNode(other.find('ab'))).toBeNull();
			expect(trie.removeNode(trie.root())).toBeNull();
			expect(trie.removeNode(trie.find('ab')!.parent())).toBeNull();
			expect(trie.removeNode(new TrieElement('ab'))).toBeNull();
			expect(trie.size()).toBe(1);
			expect(other.size()).toBe(1);
		});

		it('removeNode twice removes once', () => {
			const node = trie.insert('ab') as TrieElement<string>;
			trie.insert('abc');

			expect(trie.removeNode(node)).toBe('ab');
			expect(trie.removeNode(node)).toBeNull();
			expect(trie.size()).toBe(1);
		});
	});

	describe('update', () => {
		it('keeps the node when the key is unchanged', () => {
			const entries = new Trie<Entry>(byK);
			const node = entries.insert({k: 'a', v: 1}) as TrieElement<Entry>;
			const replacement = {k: 'a', v: 2};

			expect(entries.update(node, replacement)).toBe(node);
			expect(entries.get('a')).toBe(replacement);
			expectValid(entries);
		});

		it('invalidates stale query results when the key is unchanged', () => {
			const entries = new Trie<Entry>(byK, [{k: 'a', v: 1}]);
			const [result] = entries.query(() => true);
			const node = entries.find('a')!;
			const replacement = {k: 'a', v: 2};

			expect(entries.update(node, replacement)).toBe(node);
			expect(result.delete()).toBeNull();
			expect(entries.get('a')).toBe(replacement);
			expectValid(entries);
		});

		it('skips an undefined item as a no-op, or throws when not allowed', () => {
			const byOptK = (entry?: Entry): string => entry?.k ?? '';
			const entries = new Trie<Entry | undefined>(byOptK, [{k: 'a', v: 1}]);
			const node = entries.find('a')!;

			expect(entries.update(node, undefined)).toBe('undefined_item');
			expect(entries.get('a')).toEqual({k: 'a', v: 1});
			expect(entries.size()).toBe(1);

			const strict = new Trie<Entry | undefined>(byOptK, [{k: 'a', v: 1}], {allowUndefinedItem: false});

			expect(() => strict.update(strict.find('a'), undefined)).toThrow();
			expect(strict.get('a')).toEqual({k: 'a', v: 1});
		});

		it('moves an item changed in place to its new key', () => {
			const entries = new Trie<Entry>(byK);
			const item = {k: 'abc', v: 1};
			const node = entries.insert(item) as TrieElement<Entry>;
			entries.insert({k: 'b', v: 2});
			item.k = 'xyz';

			const moved = entries.update(node, item) as TrieElement<Entry>;

			// With pooling on, the dropped node may be reissued for the new key.
			expect(moved).toBe(entries.find('xyz'));
			expect(moved.key()).toBe('xyz');
			expect(entries.get('xyz')).toBe(item);
			expect(entries.contains('abc')).toBe(false);
			expect(entries.size()).toBe(2);
			expectValid(entries);
		});

		it('moves to a key extending the old one', () => {
			const entries = new Trie<Entry>(byK);
			const item = {k: 'ab', v: 1};
			const node = entries.insert(item) as TrieElement<Entry>;
			item.k = 'abcd';

			const moved = entries.update(node, item) as TrieElement<Entry>;

			expect(moved.key()).toBe('abcd');
			expect(entries.keys()).toEqual(['abcd']);
			expectValid(entries);
		});

		it('replaces an item already stored under the new key', () => {
			const entries = new Trie<Entry>(byK, [
				{k: 'a', v: 1},
				{k: 'b', v: 2}
			]);
			const node = entries.find('a')!;
			const item = {k: 'b', v: 3};

			expect(entries.update(node, item)).toBe(entries.find('b'));
			expect(entries.size()).toBe(1);
			expect(entries.get('b')).toBe(item);
			expectValid(entries);
		});

		it('removes the item when the new key is invalid', () => {
			const entries = new Trie<any>(byWord, ['a', 'b']);

			expect(entries.update(entries.find('a'), 5)).toBe('invalid_key');
			expect(entries.keys()).toEqual(['b']);
			expectValid(entries);
		});

		it('returns null and changes nothing for nodes it does not hold items for', () => {
			trie.insert('ab');

			expect(trie.update(null, 'x')).toBeNull();
			expect(trie.update(trie.root(), 'x')).toBeNull();
			expect(trie.update(new TrieElement('q'), 'x')).toBeNull();
			expect(trie.keys()).toEqual(['ab']);
		});
	});

	describe('navigation', () => {
		const words = ['', 'a', 'ab', 'abc', 'abd', 'b', 'ba', 'c'];

		beforeEach(() => {
			trie.insertArray(words.slice().reverse());
		});

		it('min and max are the first and last keys', () => {
			expect(trie.min()?.key()).toBe('');
			expect(trie.max()?.key()).toBe('c');

			trie.remove('');
			trie.remove('c');
			expect(trie.min()?.key()).toBe('a');
			expect(trie.max()?.key()).toBe('ba');
		});

		it('min and max are null when empty', () => {
			trie.clearElements();

			expect(trie.min()).toBeNull();
			expect(trie.max()).toBeNull();
		});

		it('max is the root when only the empty key is stored', () => {
			trie.clearElements();
			trie.insert('');

			expect(trie.max()).toBe(trie.root());
			expect(trie.min()).toBe(trie.root());
		});

		it('successor walks every key forward', () => {
			const keys: string[] = [];

			for (let node = trie.min(); node; node = trie.successor(node)) {
				keys.push(node.key()!);
			}

			expect(keys).toEqual(words);
		});

		it('predecessor walks every key backward', () => {
			const keys: string[] = [];

			for (let node = trie.max(); node; node = trie.predecessor(node)) {
				keys.push(node.key()!);
			}

			expect(keys).toEqual(words.slice().reverse());
		});

		it('predecessor skips nodes that hold no item', () => {
			trie.clearElements();
			trie.insertArray(['xa', 'xyz']);

			expect(trie.predecessor(trie.find('xyz'))?.key()).toBe('xa');
			expect(trie.predecessor(trie.find('xa'))).toBeNull();
		});

		it('successor and predecessor return null for nodes holding no item', () => {
			const other = new Trie<string>(byWord, ['a']);

			expect(trie.successor(null)).toBeNull();
			expect(trie.predecessor(null)).toBeNull();
			expect(trie.successor(other.find('a'))).toBeNull();
			expect(trie.predecessor(other.find('a'))).toBeNull();

			trie.remove('');
			expect(trie.successor(trie.root())).toBeNull();
		});
	});

	describe('prefix search', () => {
		beforeEach(() => {
			trie.insertArray(['she', 'sells', 'sea', 'shells', 'by', 'the', 'shore', 'shell']);
		});

		it('keysWithPrefix returns matching keys in key order', () => {
			expect(trie.keysWithPrefix('sh')).toEqual(['she', 'shell', 'shells', 'shore']);
			expect(trie.keysWithPrefix('shell')).toEqual(['shell', 'shells']);
			expect(trie.keysWithPrefix('x')).toEqual([]);
			expect(trie.keysWithPrefix('shellsx')).toEqual([]);
			expect(trie.keysWithPrefix(null as any)).toEqual([]);
			expect(trie.keysWithPrefix('')).toEqual(trie.keys());
		});

		it('withPrefix returns matching nodes in key order', () => {
			const nodes = trie.withPrefix('se');

			expect(nodes.map((n) => n.value())).toEqual(['sea', 'sells']);
			expect(nodes.every((n) => n instanceof TrieElement)).toBe(true);
			expect(trie.withPrefix(4 as any)).toEqual([]);
		});

		it('fills and returns a given output array', () => {
			const nodes: TrieElement<string>[] = [trie.root(), trie.root(), trie.root(), trie.root(), trie.root()];
			const keys: string[] = ['x', 'x', 'x', 'x', 'x', 'x'];

			expect(trie.withPrefix('se', nodes)).toBe(nodes);
			expect(nodes.map((n) => n.key())).toEqual(['sea', 'sells']);
			expect(trie.keysWithPrefix('sh', keys)).toBe(keys);
			expect(keys).toEqual(['she', 'shell', 'shells', 'shore']);
			expect(trie.keysWithPrefix('q', keys)).toEqual([]);
		});

		it('forEachWithPrefix visits matches in key order', () => {
			const seen: [string, number][] = [];
			const self = {};
			let receivedThis: unknown;
			let receivedTrie: unknown;

			const result = trie.forEachWithPrefix(
				'sh',
				function (this: unknown, elem, idx, t) {
					receivedThis = this;
					receivedTrie = t;
					seen.push([elem.key()!, idx]);
				},
				self
			);

			expect(result).toBe(trie);
			expect(receivedThis).toBe(self);
			expect(receivedTrie).toBe(trie);
			expect(seen).toEqual([
				['she', 0],
				['shell', 1],
				['shells', 2],
				['shore', 3]
			]);
		});

		it('forEachWithPrefix visits nothing without a match', () => {
			const func = jest.fn();

			trie.forEachWithPrefix('zz', func);
			trie.forEachWithPrefix(undefined as any, func);
			expect(func).not.toHaveBeenCalled();
		});

		it('forEachWithPrefix allows removing each visited item', () => {
			const seen: string[] = [];

			trie.forEachWithPrefix('sh', (elem) => {
				seen.push(elem.key()!);
				trie.removeNode(elem);
			});

			expect(seen).toEqual(['she', 'shell', 'shells', 'shore']);
			expect(trie.keys()).toEqual(['by', 'sea', 'sells', 'the']);
			expect(trie.hasPrefix('sh')).toBe(false);
			expectValid(trie);
		});

		it('forEachWithPrefix continues past a next item removed from a node that stays linked', () => {
			const seen: string[] = [];

			trie.forEachWithPrefix('she', (elem) => {
				seen.push(elem.key()!);
				if (elem.key() === 'she') {
					trie.remove('shell');
				}
			});

			expect(seen).toEqual(['she', 'shells']);
		});

		it('forEachWithPrefix continues past a next node pruned by func', () => {
			const seen: string[] = [];

			trie.forEachWithPrefix('', (elem) => {
				seen.push(elem.key()!);
				if (elem.key() === 'sea') {
					// 'sells' is the captured next node; removing it prunes it.
					trie.remove('sells');
				}
			});

			expect(seen).toEqual(['by', 'sea', 'she', 'shell', 'shells', 'shore', 'the']);
			expectValid(trie);
		});

		it('forEachWithPrefix ends when func removes every remaining item', () => {
			const seen: string[] = [];

			trie.forEachWithPrefix('', (elem) => {
				seen.push(elem.key()!);
				trie.clearElements();
			});

			expect(seen).toEqual(['by']);
		});

		it('forEachWithPrefix stays within its prefix after func prunes the next node', () => {
			const seen: string[] = [];

			trie.forEachWithPrefix('sh', (elem) => {
				seen.push(elem.key()!);
				if (elem.key() === 'she') {
					trie.remove('shell');
				}
			});

			expect(seen).toEqual(['she', 'shells', 'shore']);
			expectValid(trie);
		});
	});

	describe('traversal', () => {
		beforeEach(() => {
			trie.insertArray(['dog', 'cat', 'do', 'catalog']);
		});

		it('keys, values, and toArray are in key order', () => {
			expect(trie.keys()).toEqual(['cat', 'catalog', 'do', 'dog']);
			expect(trie.values()).toEqual(['cat', 'catalog', 'do', 'dog']);
			expect(trie.toArray().map((n) => n.key())).toEqual(['cat', 'catalog', 'do', 'dog']);
		});

		it('values fills and returns a given output array', () => {
			const out: string[] = ['x', 'x', 'x', 'x', 'x', 'x'];

			expect(trie.values(out)).toBe(out);
			expect(out).toEqual(['cat', 'catalog', 'do', 'dog']);
		});

		it('values returns items, not keys', () => {
			const entries = new Trie<Entry>(byK, [
				{k: 'b', v: 2},
				{k: 'a', v: 1}
			]);

			expect(entries.values()).toEqual([
				{k: 'a', v: 1},
				{k: 'b', v: 2}
			]);
		});

		it('iterates items in key order', () => {
			expect([...trie]).toEqual(['cat', 'catalog', 'do', 'dog']);
			expect(trie[Symbol.iterator]()).toBeInstanceOf(TrieIterator);
			expect([...new Trie<string>(byWord)]).toEqual([]);
		});

		it('iterator reuses its result object', () => {
			const iterator = trie[Symbol.iterator]();
			const first = iterator.next();

			expect(iterator.next()).toBe(first);
		});
	});

	describe('forEach', () => {
		it('visits every element in key order with index and trie', () => {
			trie.insertArray(['b', 'a', 'c']);
			const seen: [string, number][] = [];

			const result = trie.forEach((elem, idx, t) => {
				expect(t).toBe(trie);
				seen.push([elem.value()!, idx]);
			});

			expect(result).toBe(trie);
			expect(seen).toEqual([
				['a', 0],
				['b', 1],
				['c', 2]
			]);
		});

		it('uses thisArg as passed', () => {
			trie.insert('a');
			const self = {};
			let received: unknown = null;

			trie.forEach(function (this: unknown) {
				received = this;
			}, self);
			expect(received).toBe(self);

			trie.forEach(function (this: unknown) {
				received = this;
			});
			expect(received).toBeUndefined();
		});

		it('allows removing the current element', () => {
			trie.insertArray(['a', 'ab', 'abc', 'b']);

			trie.forEach((elem) => {
				trie.removeNode(elem);
			});

			expect(trie.size()).toBe(0);
			expect(nodeCount(trie)).toBe(1);
		});

		it('continues past a next element removed and pruned by func', () => {
			trie.insertArray(['a', 'ab', 'b']);
			const seen: string[] = [];

			trie.forEach((elem) => {
				seen.push(elem.key()!);
				if (elem.key() === 'a') {
					trie.remove('ab');
				}
			});

			expect(seen).toEqual(['a', 'b']);
			expectValid(trie);
		});

		it('is not misled by a next node recycled into another key during func', () => {
			trie.insertArray(['b', 'c']);
			const seen: string[] = [];

			trie.forEach((elem) => {
				seen.push(elem.key()!);
				if (elem.key() === 'b') {
					// Releases node 'c' to the pool, which reissues it as node
					// 'a', behind the walk, before the captured next node runs.
					trie.remove('c');
					trie.insert('a');
				}
			});

			expect(seen).toEqual(['b']);
			expect(trie.keys()).toEqual(['a', 'b']);
			expectValid(trie);
		});

		it('visits an item replaced at the next key with its new value', () => {
			const entries = new Trie<Entry>(byK, [
				{k: 'a', v: 1},
				{k: 'b', v: 2}
			]);
			const seen: number[] = [];

			entries.forEach((elem) => {
				seen.push(elem.value()!.v);
				if (elem.key() === 'a') {
					entries.insert({k: 'b', v: 9});
				}
			});

			expect(seen).toEqual([1, 9]);
		});
	});

	describe('filter', () => {
		it('returns a new trie of matching items with the same key selector', () => {
			const entries = new Trie<Entry>(byK, [
				{k: 'a', v: 1},
				{k: 'b', v: 2},
				{k: 'c', v: 3}
			]);

			const result = entries.filter((elem) => elem.value()!.v !== 2);

			expect(result).toBeInstanceOf(Trie);
			expect(result).not.toBe(entries);
			expect(result.keySelector).toBe(byK);
			expect(result.keys()).toEqual(['a', 'c']);
			expect(entries.size()).toBe(3);
			expectValid(result);
		});

		it('passes index and trie, and uses thisArg as passed', () => {
			trie.insertArray(['x', 'y']);
			const self = {};
			const calls: unknown[][] = [];

			trie.filter(function (this: unknown, elem, idx, t) {
				calls.push([this, elem.key(), idx, t]);
				return true;
			}, self);

			expect(calls).toEqual([
				[self, 'x', 0, trie],
				[self, 'y', 1, trie]
			]);
		});

		it('keeps pooling options', () => {
			const plain = new Trie<string>(byWord, ['a'], {disableElementPooling: true});

			expect(poolOf(plain.filter(() => true))).toBeNull();
			expect(poolOf(trie.filter(() => true))).toBeInstanceOf(ObjectPool);
		});
	});

	describe('query', () => {
		beforeEach(() => {
			trie.insertArray(['apple', 'apply', 'banana', 'band']);
		});

		it('returns matches in key order with their keys', () => {
			const results = trie.query((v) => v.startsWith('ap'));

			expect(results.map((r) => r.element.value())).toEqual(['apple', 'apply']);
			expect(results.map((r) => r.key())).toEqual(['apple', 'apply']);
			expect(results[0].index()).toBeNull();
		});

		it('requires every filter in an array to pass', () => {
			const results = trie.query([(v) => v.startsWith('b'), (v) => v.length === 4]);

			expect(results.map((r) => r.key())).toEqual(['band']);
			expect(trie.query([])).toEqual([]);
		});

		it('honors the limit', () => {
			expect(trie.query(() => true, {limit: 2}).length).toBe(2);
			expect(trie.query(() => true, {limit: 0}).length).toBe(4);
			expect(trie.query(() => true, {limit: NaN}).length).toBe(4);
		});

		it('delete removes the matched item', () => {
			const [result] = trie.query((v) => v === 'band');

			expect(result.delete()).toBe('band');
			expect(trie.contains('band')).toBe(false);
			expect(result.delete()).toBeNull();
			expectValid(trie);
		});

		it('key keeps the matched key after the item is removed', () => {
			const [result] = trie.query((v) => v === 'band');
			result.delete();

			expect(result.key()).toBe('band');
		});

		it('delete does nothing after the item is replaced', () => {
			const [result] = trie.query((v) => v === 'band');
			trie.insert('band');

			expect(result.delete()).toBeNull();
			expect(trie.contains('band')).toBe(true);
		});

		it('delete does nothing after the node is reissued', () => {
			const [result] = trie.query((v) => v === 'band');
			trie.remove('band');
			trie.insert('band');

			expect(result.delete()).toBeNull();
			expect(trie.contains('band')).toBe(true);
		});
	});

	describe('stringify', () => {
		it('serializes items in key order', () => {
			trie.insertArray(['b', 'a']);

			expect(JSON.parse(trie.stringify()!)).toEqual({type: 'Trie', elements: ['a', 'b']});
		});

		it('returns null when an item cannot be serialized', () => {
			const bad = new Trie<any>(() => 'k', [{n: BigInt(1)}]);

			expect(bad.stringify()).toBeNull();
		});
	});

	describe('clearElements / reset', () => {
		it('removes every item and node but the root', () => {
			trie.insertArray(['', 'a', 'ab', 'b', 'bcd']);
			const nodes = trie.toArray().filter((n) => n !== trie.root());

			expect(trie.clearElements()).toBe(trie);
			expect(trie.size()).toBe(0);
			expect(nodeCount(trie)).toBe(1);
			expect(trie.root().isTerminal()).toBe(false);
			expect(trie.root().value()).toBeNull();
			expect(nodes.every((n) => n._trie === null)).toBe(true);
			expectValid(trie);
		});

		it('returns every node to the pool', () => {
			trie.insertArray(['abc', 'abd', 'x']);
			trie.clearElements();

			expect(poolOf(trie)!.size()).toBe(0);
		});

		it('reset keeps the key selector and allows reuse', () => {
			trie.insert('a');

			expect(trie.reset()).toBe(trie);
			expect(trie.keySelector).toBe(byWord);
			trie.insert('b');
			expect(trie.keys()).toEqual(['b']);
		});
	});
});
