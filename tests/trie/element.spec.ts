import {Trie} from '../../src/trie';
import {TrieElement} from '../../src/trie/element';

interface Entry {
	k: string;
	v: number;
}

const byK = (entry: Entry): string => entry.k;

describe('TrieElement', () => {
	it('starts blank or with the given value', () => {
		const blank = new TrieElement<number>();

		expect(blank.value()).toBeNull();
		expect(blank.key()).toBeNull();
		expect(blank.parent()).toBeNull();
		expect(blank.children()).toEqual([]);
		expect(blank.isLeaf()).toBe(true);
		expect(blank.isTerminal()).toBe(false);
		expect(new TrieElement(4).value()).toBe(4);
	});

	it('cleanObj resets every field to a fresh node', () => {
		const trie = new Trie<string>((w) => w, ['ab', 'ac', 'abc']);
		const node = trie.find('ab')!;
		node.cleanObj();

		expect(node).toEqual(new TrieElement<string>());
	});

	it('children lists existing children in code unit order', () => {
		const trie = new Trie<string>((w) => w, ['ac', 'ab', 'aa']);
		const a = trie.root().child('a')!;

		expect(a.children().map((c) => c.key())).toEqual(['aa', 'ab', 'ac']);
		expect(a.isLeaf()).toBe(false);
		expect(a.children()[0].isLeaf()).toBe(true);
		expect(a.children()[0].parent()).toBe(a);

		trie.remove('ab');
		expect(a.children().map((c) => c.key())).toEqual(['aa', 'ac']);
	});

	it('children fills and returns a given output array instead of allocating', () => {
		const trie = new Trie<string>((w) => w, ['a', 'b']);
		const root = trie.root();
		const out: TrieElement<string>[] = [root, root, root, root];

		expect(root.children(out)).toBe(out);
		expect(out.map((c) => c.key())).toEqual(['a', 'b']);
		expect(trie.find('a')!.children(out)).toBe(out);
		expect(out).toEqual([]);
		expect(root.children(null as any).map((c) => c.key())).toEqual(['a', 'b']);
	});

	it('child finds a child by its first code unit', () => {
		const trie = new Trie<string>((w) => w, ['cat', 'cow']);
		const c = trie.root().child('c')!;

		expect(c.child('a')?.child('t')?.key()).toBe('cat');
		expect(c.child('ow')?.key()).toBeNull();
		expect(c.child('o')?.child('w')?.key()).toBe('cow');
		expect(c.child('x')).toBeNull();
		expect(c.child('')).toBeNull();
		expect(c.child(null as any)).toBeNull();
	});

	it('sets any value while unlinked', () => {
		const node = new TrieElement<number>(1);

		expect(node.value(9)).toBeNull();
		expect(node.value()).toBe(9);
	});

	it('only accepts a value with the same key while linked', () => {
		const trie = new Trie<Entry>(byK, [
			{k: 'a', v: 1},
			{k: 'ab', v: 2}
		]);
		const node = trie.find('a')!;
		const same = {k: 'a', v: 3};

		node.value(same);
		expect(trie.get('a')).toBe(same);

		node.value({k: 'b', v: 4});
		expect(trie.get('a')).toBe(same);
	});

	it('ignores values set on a linked node that holds no item', () => {
		const trie = new Trie<Entry>(byK, [{k: 'ab', v: 1}]);
		const a = trie.root().child('a')!;

		a.value({k: 'a', v: 2});
		expect(a.value()).toBeNull();
		expect(trie.contains('a')).toBe(false);
	});
});
