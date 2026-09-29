import {RedBlackTree} from '../../../src/red/black/tree';
import {RedBlackTreeElement} from '../../../src/red/black/tree/element';
import {RedBlackTreeIterator} from '../../../src/red/black/tree/iterator';
import {ObjectPool} from '../../../src/object/pool';

const byNumber = (a: number, b: number): number => a - b;
const poolOf = (target: RedBlackTree<any>): ObjectPool<any> | null => (target as any).elements.objectPool;

/**
 * Walk the whole tree and check every structural rule: parent links agree with
 * child links, left subtrees are equal or smaller, right subtrees are equal or
 * larger, every node is owned by the tree, and size matches the node count.
 * Also checks every red-black rule: the root is black, no red node has a red
 * child, every path down to a missing child has the same number of black
 * nodes, and the height stays within 2 log2(n + 1).
 */
const expectValid = <T>(tree: RedBlackTree<T>): void => {
	const root = tree.root();
	let count = 0;
	let pathBlacks: number | null = null;

	if (root) {
		expect(root.parent()).toBeNull();
		expect(root.color()).toBe('black');
	}

	// Missing children are pushed too, so every path's black count is checked
	// where it ends.
	const stack: {node: RedBlackTreeElement<T> | null; low: T | null; high: T | null; blacks: number}[] = [
		{node: root, low: null, high: null, blacks: 0}
	];

	while (stack.length) {
		const {node, low, high, blacks} = stack.pop()!;

		if (!node) {
			if (pathBlacks === null) {
				pathBlacks = blacks;
			}
			expect(blacks).toBe(pathBlacks);
			continue;
		}

		const value = node.value() as T;
		const below = blacks + (node.color() === 'black' ? 1 : 0);
		count++;

		expect(node._tree).toBe(tree);
		if (low !== null) {
			expect(tree.comparator(value, low)).toBeGreaterThanOrEqual(0);
		}
		if (high !== null) {
			expect(tree.comparator(value, high)).toBeLessThanOrEqual(0);
		}

		const left = node.left();
		const right = node.right();

		if (node.color() === 'red') {
			expect(left?.color()).not.toBe('red');
			expect(right?.color()).not.toBe('red');
		}
		if (left) {
			expect(left.parent()).toBe(node);
		}
		if (right) {
			expect(right.parent()).toBe(node);
		}

		stack.push(
			{node: left, low, high: value, blacks: below},
			{node: right, low: value, high, blacks: below}
		);
	}

	expect(tree.size()).toBe(count);
	expect(tree.blackHeight()).toBe(pathBlacks);
	expect(tree.height()).toBeLessThanOrEqual(2 * Math.log2(count + 1));
};

const tree = new RedBlackTree<number>(byNumber);

describe('RedBlackTree', () => {
	beforeEach(() => {
		tree.reset();
		expect(tree.isEmpty()).toBe(true);
	});

	describe('INSTANTIATION', () => {
		it('with only a comparator', () => {
			const result = new RedBlackTree<number>(byNumber);

			expect(result).toBeInstanceOf(RedBlackTree);
			expect(result.size()).toBe(0);
			expect(result.root()).toBeNull();
			expect(result.comparator).toBe(byNumber);
		});

		it('with items inserted in array order', () => {
			const result = new RedBlackTree<number>(byNumber, [5, 3, 8]);

			expect(result.size()).toBe(3);
			expect(result.root()?.value()).toBe(5);
			expect(result.root()?.left()?.value()).toBe(3);
			expect(result.root()?.right()?.value()).toBe(8);
			expectValid(result);
		});

		it('does not keep a reference to the provided array', () => {
			const items = [1, 2, 3];
			const result = new RedBlackTree<number>(byNumber, items);
			items.push(4);

			expect(result.size()).toBe(3);
		});

		it('throws without a comparator function', () => {
			expect(() => new RedBlackTree<number>(undefined as any)).toThrow();
			expect(() => new RedBlackTree<number>(null as any)).toThrow();
			expect(() => new RedBlackTree<number>({} as any)).toThrow();
		});

		it('ignores invalid data and options instead of throwing', () => {
			expect(new RedBlackTree(byNumber, 'adsf' as any).size()).toBe(0);
			expect(new RedBlackTree(byNumber, null).size()).toBe(0);
			expect(new RedBlackTree(byNumber, {elements: [4]} as any).size()).toBe(0);
			expect(new RedBlackTree(byNumber, [1], null).size()).toBe(1);
			expect(new RedBlackTree(byNumber, [1], 'nope' as any).size()).toBe(1);
		});
	});

	describe('ELEMENT POOLING', () => {
		it('is enabled by default', () => {
			expect(poolOf(new RedBlackTree(byNumber))).toBeInstanceOf(ObjectPool);
		});

		it('only strict true disables it', () => {
			expect(poolOf(new RedBlackTree(byNumber, [], {disableElementPooling: true}))).toBeNull();
			expect(
				poolOf(new RedBlackTree(byNumber, [], {disableElementPooling: 'true' as any}))
			).toBeInstanceOf(ObjectPool);
		});

		it('recycles a removed node for a later insert', () => {
			const pooled = new RedBlackTree<number>(byNumber);
			const first = pooled.insert(1) as RedBlackTreeElement<number>;
			pooled.removeNode(first);

			const second = pooled.insert(2) as RedBlackTreeElement<number>;

			expect(second).toBe(first);
			expect(second.value()).toBe(2);
			expect(second.color()).toBe('black');
			expect(pooled.values()).toEqual([2]);
		});

		it('reuses pooled nodes instead of allocating in steady state', () => {
			const pooled = new RedBlackTree<number>(byNumber, [], {pool: {startSize: 4}});
			const seen = new Set<unknown>();

			for (let round = 0; round < 50; round++) {
				pooled.insertArray([round, round + 1, round + 2, round + 3]);
				pooled.forEach((node) => seen.add(node));
				pooled.update(pooled.min(), round + 10);
				pooled.clearElements();
			}

			expect(seen.size).toBe(4);
		});

		it('does not recycle when pooling is disabled', () => {
			const plain = new RedBlackTree<number>(byNumber, [], {disableElementPooling: true});
			const first = plain.insert(1) as RedBlackTreeElement<number>;
			plain.removeNode(first);

			expect(plain.insert(2)).not.toBe(first);
			expect(first._tree).toBeNull();
		});

		it('blanks a removed node when pooling is disabled, so it does not keep its item', () => {
			const plain = new RedBlackTree<{id: number}>((a, b) => a.id - b.id, [], {
				disableElementPooling: true
			});
			const item = {id: 1};
			const node = plain.insert(item) as RedBlackTreeElement<{id: number}>;
			plain.insert({id: 2});
			plain.insert({id: 0});

			expect(plain.removeNode(node)).toBe(item);
			expect(node.value()).toBeNull();
			expect(node._tree).toBeNull();
			expect(node._linkId).toBe(0);
			expect(node.parent()).toBeNull();
			expect(node.isLeaf()).toBe(true);
			expect(node.color()).toBe('red');
		});

		it('blanks every node on clearElements when pooling is disabled', () => {
			const plain = new RedBlackTree<number>(byNumber, [5, 3, 8, 1, 4, 9], {
				disableElementPooling: true
			});
			const nodes = plain.toArray();
			plain.clearElements();

			for (const node of nodes) {
				expect(node.value()).toBeNull();
				expect(node._tree).toBeNull();
				expect(node.parent()).toBeNull();
				expect(node.isLeaf()).toBe(true);
			}
		});

		it('clearElements returns every node to the pool', () => {
			const pooled = new RedBlackTree<number>(byNumber);
			for (let i = 0; i < 100; i++) {
				pooled.insert((i * 37) % 101);
			}
			const nodes = new Set(pooled.toArray());
			const pool = poolOf(pooled) as ObjectPool<any>;

			expect(pool.size()).toBe(100);
			pooled.clearElements();
			expect(pool.size()).toBe(0);

			for (let i = 0; i < 100; i++) {
				expect(nodes.has(pooled.insert(i) as RedBlackTreeElement<number>)).toBe(true);
			}
			expectValid(pooled);
		});

		it('behaves the same with pooling disabled', () => {
			const plain = new RedBlackTree<number>(byNumber, [5, 3, 8, 1, 4], {
				disableElementPooling: true
			});

			expect(plain.remove(3)).toBe(3);
			expect(plain.values()).toEqual([1, 4, 5, 8]);
			expectValid(plain);
			expect(plain.clearElements().size()).toBe(0);
		});

		it('filter keeps the pooling options', () => {
			const plain = new RedBlackTree<number>(byNumber, [1, 2], {disableElementPooling: true});

			expect(poolOf(plain.filter(() => true))).toBeNull();
		});
	});

	describe('insert', () => {
		it('places items in sorted position', () => {
			tree.insertArray([50, 30, 70, 20, 40, 60, 80]);

			expect(tree.values()).toEqual([20, 30, 40, 50, 60, 70, 80]);
			expect(tree.height()).toBe(2);
			expectValid(tree);
		});

		it('returns the node holding the item', () => {
			const node = tree.insert(7) as RedBlackTreeElement<number>;

			expect(node).toBeInstanceOf(RedBlackTreeElement);
			expect(node.value()).toBe(7);
			expect(node.color()).toBe('black');
			expect(tree.root()).toBe(node);
		});

		it('recolors when the uncle is red', () => {
			tree.insertArray([20, 10, 30]);
			expect(tree.root()?.left()?.color()).toBe('red');
			expect(tree.root()?.right()?.color()).toBe('red');

			tree.insert(5);
			expect(tree.root()?.value()).toBe(20);
			expect(tree.root()?.left()?.color()).toBe('black');
			expect(tree.root()?.right()?.color()).toBe('black');
			expect(tree.find(5)?.color()).toBe('red');
			expectValid(tree);
		});

		it('rotates once for an outer grandchild', () => {
			tree.insertArray([30, 20, 10]);

			expect(tree.levelOrder()).toEqual([20, 10, 30]);
			expectValid(tree);

			const mirror = new RedBlackTree<number>(byNumber, [10, 20, 30]);
			expect(mirror.levelOrder()).toEqual([20, 10, 30]);
			expectValid(mirror);
		});

		it('rotates twice for an inner grandchild', () => {
			tree.insertArray([30, 10, 20]);

			expect(tree.levelOrder()).toEqual([20, 10, 30]);
			expectValid(tree);

			const mirror = new RedBlackTree<number>(byNumber, [10, 30, 20]);
			expect(mirror.levelOrder()).toEqual([20, 10, 30]);
			expectValid(mirror);
		});

		it('stays balanced for sorted input', () => {
			const count = 15000;
			for (let i = 0; i < count; i++) {
				tree.insert(i);
			}

			expect(tree.height()).toBeLessThanOrEqual(2 * Math.log2(count + 1));
			expect(tree.values().length).toBe(count);
			expect(tree.preOrder().length).toBe(count);
			expect(tree.postOrder().length).toBe(count);
			expect(tree.levelOrder().length).toBe(count);
			expectValid(tree);
			expect(tree.clearElements().size()).toBe(0);
		});

		it('stays balanced for reverse sorted input', () => {
			for (let i = 1000; i > 0; i--) {
				tree.insert(i);
			}

			expect(tree.min()?.value()).toBe(1);
			expectValid(tree);
		});

		it('places equal items after existing ones', () => {
			const byKey = (a: {k: number}, b: {k: number}): number => a.k - b.k;
			const keyed = new RedBlackTree<{k: number; id: string}>(byKey);
			const a = {k: 1, id: 'a'};
			const b = {k: 1, id: 'b'};
			const c = {k: 0, id: 'c'};
			const d = {k: 1, id: 'd'};
			keyed.insertArray([a, b, c, d]);

			expect(keyed.values()).toEqual([c, a, b, d]);
			expect(keyed.find({k: 1, id: ''})?.value()).toBe(a);
			expect(keyed.max()?.value()).toBe(d);
			expectValid(keyed);
		});

		it('keeps insertion order across rotations of many equal items', () => {
			const byKey = (a: {k: number}, b: {k: number}): number => a.k - b.k;
			const keyed = new RedBlackTree<{k: number; id: number}>(byKey);
			const items = new Array(64).fill(0).map((_, id) => ({k: id % 3, id}));
			keyed.insertArray(items);

			const expected = [...items].sort((x, y) => x.k - y.k || x.id - y.id);
			expect(keyed.values()).toEqual(expected);
			expect(keyed.find({k: 1, id: -1})?.value()).toBe(items[1]);
			expect(keyed.find({k: 2, id: -1})?.value()).toBe(items[2]);
			expectValid(keyed);
		});

		it('stores null items as given and skips undefined items', () => {
			const anything = new RedBlackTree<number | null | undefined>(() => 0);
			anything.insertArray([null, undefined, 3]);

			expect(anything.values()).toEqual([null, 3]);
			expect(anything.size()).toBe(2);
			expect(anything.insert(undefined)).toBe('undefined_item');
		});

		it('insertArray ignores non-arrays', () => {
			tree.insertArray(null);
			tree.insertArray('abc' as any);

			expect(tree.size()).toBe(0);
		});
	});

	describe('find / contains', () => {
		beforeEach(() => tree.insertArray([50, 30, 70, 20, 40]));

		it('finds the node of an equal item', () => {
			expect(tree.find(40)?.value()).toBe(40);
			expect(tree.contains(20)).toBe(true);
		});

		it('returns null / false when absent', () => {
			expect(tree.find(45)).toBeNull();
			expect(tree.contains(45)).toBe(false);
			expect(new RedBlackTree(byNumber).find(1)).toBeNull();
		});
	});

	describe('remove / removeNode', () => {
		beforeEach(() => tree.insertArray([50, 30, 70, 20, 40, 60, 80, 35, 45]));

		it('removes a red leaf', () => {
			expect(tree.find(35)?.color()).toBe('red');
			expect(tree.remove(35)).toBe(35);
			expect(tree.values()).toEqual([20, 30, 40, 45, 50, 60, 70, 80]);
			expectValid(tree);
		});

		it('removes a black leaf', () => {
			expect(tree.find(20)?.color()).toBe('black');
			expect(tree.remove(20)).toBe(20);
			expect(tree.values()).toEqual([30, 35, 40, 45, 50, 60, 70, 80]);
			expectValid(tree);
		});

		it('removes a node with one child', () => {
			tree.remove(35);
			expect(tree.remove(40)).toBe(40);
			expect(tree.values()).toEqual([20, 30, 45, 50, 60, 70, 80]);
			expectValid(tree);
		});

		it('removes a node with two children', () => {
			expect(tree.remove(30)).toBe(30);
			expect(tree.remove(70)).toBe(70);
			expect(tree.values()).toEqual([20, 35, 40, 45, 50, 60, 80]);
			expectValid(tree);
		});

		it('removes the root', () => {
			expect(tree.remove(50)).toBe(50);
			expect(tree.root()?.parent()).toBeNull();
			expectValid(tree);
		});

		it('removes down to empty', () => {
			for (const item of [50, 30, 70, 20, 40, 60, 80, 35, 45]) {
				expect(tree.remove(item)).toBe(item);
				expectValid(tree);
			}

			expect(tree.isEmpty()).toBe(true);
			expect(tree.root()).toBeNull();
			expect(tree.blackHeight()).toBe(0);
		});

		it('removes from both ends of a sorted run', () => {
			tree.reset();
			for (let i = 0; i < 256; i++) {
				tree.insert(i);
			}

			for (let i = 0; i < 128; i++) {
				expect(tree.remove(i)).toBe(i);
				expect(tree.remove(255 - i)).toBe(255 - i);
				expectValid(tree);
			}

			expect(tree.isEmpty()).toBe(true);
		});

		it('keeps other node handles holding their items', () => {
			const node60 = tree.find(60)!;
			const node80 = tree.find(80)!;
			tree.remove(70);
			tree.remove(20);

			expect(node60.value()).toBe(60);
			expect(node80.value()).toBe(80);
			expect(tree.find(60)).toBe(node60);
			expect(tree.find(80)).toBe(node80);
		});

		it('returns null for absent items and foreign or stale nodes', () => {
			const other = new RedBlackTree<number>(byNumber, [20]);
			const node = tree.find(20)!;

			expect(tree.remove(99)).toBeNull();
			expect(tree.removeNode(null)).toBeNull();
			expect(tree.removeNode(other.root())).toBeNull();
			expect(tree.removeNode(new RedBlackTreeElement(20))).toBeNull();
			expect(tree.removeNode(node)).toBe(20);
			expect(tree.removeNode(node)).toBeNull();
			expect(tree.size()).toBe(8);
			expect(other.size()).toBe(1);
		});

		it('clears the removed node', () => {
			const node = tree.find(30)!;
			tree.removeNode(node);

			expect(node.value()).toBeNull();
			expect(node.left()).toBeNull();
			expect(node.right()).toBeNull();
			expect(node.parent()).toBeNull();
			expect(node.color()).toBe('red');
		});

		it('removes one of several equal items, the first in sorted order', () => {
			const byKey = (a: {k: number}, b: {k: number}): number => a.k - b.k;
			const keyed = new RedBlackTree<{k: number}>(byKey);
			const a = {k: 1};
			const b = {k: 1};
			const c = {k: 1};
			keyed.insertArray([a, {k: 0}, b, {k: 2}, c]);

			expect(keyed.remove({k: 1})).toBe(a);
			expect(keyed.remove({k: 1})).toBe(b);
			expect(keyed.remove({k: 1})).toBe(c);
			expect(keyed.remove({k: 1})).toBeNull();
			expectValid(keyed);
		});

		it('stays valid across random inserts and removals', () => {
			let seed = 42;
			const random = (): number => {
				seed = (seed * 1103515245 + 12345) % 2147483648;
				return seed % 200;
			};
			const mirror: number[] = [];
			tree.reset();

			for (let i = 0; i < 3000; i++) {
				const item = random();
				if (i % 3 === 0) {
					const index = mirror.indexOf(item);
					expect(tree.remove(item)).toBe(index >= 0 ? item : null);
					if (index >= 0) {
						mirror.splice(index, 1);
					}
				} else {
					tree.insert(item);
					mirror.push(item);
				}

				if (i % 50 === 0) {
					expectValid(tree);
				}
			}

			expect(tree.values()).toEqual(mirror.sort(byNumber));
			expectValid(tree);
		});

		it('stays valid across random removals by node', () => {
			let seed = 7;
			const random = (bound: number): number => {
				seed = (seed * 1103515245 + 12345) % 2147483648;
				return seed % bound;
			};
			const items = new Array(500).fill(0).map((_, i) => i);
			tree.reset();
			tree.insertArray(items.map(() => random(1000)));

			while (!tree.isEmpty()) {
				const nodes = tree.toArray();
				const node = nodes[random(nodes.length)];
				const value = node.value();

				expect(tree.removeNode(node)).toBe(value);
				expectValid(tree);
			}
		});
	});

	describe('allowDuplicates', () => {
		it('defaults to true and only takes booleans', () => {
			expect(new RedBlackTree(byNumber).allowDuplicates).toBe(true);
			expect(new RedBlackTree(byNumber, [], {}).allowDuplicates).toBe(true);
			expect(new RedBlackTree(byNumber, [], {allowDuplicates: true}).allowDuplicates).toBe(true);
			expect(new RedBlackTree(byNumber, [], {allowDuplicates: false}).allowDuplicates).toBe(false);
			for (const invalid of [0, 1, 'false', null, undefined, {}]) {
				expect(
					new RedBlackTree(byNumber, [], {allowDuplicates: invalid as any}).allowDuplicates
				).toBe(true);
			}
		});

		it('when disabled, insert returns an error code and adds nothing', () => {
			const unique = new RedBlackTree<number>(byNumber, [5, 3, 8], {allowDuplicates: false});
			const allocatedBefore = poolOf(unique)!.size();

			expect(unique.insert(3)).toBe('duplicate_not_allowed');
			expect(unique.insert(8)).toBe('duplicate_not_allowed');
			expect(unique.size()).toBe(3);
			expect(poolOf(unique)!.size()).toBe(allocatedBefore);
			expect(unique.insert(4)).toBeInstanceOf(RedBlackTreeElement);
			expect(unique.values()).toEqual([3, 4, 5, 8]);
			expectValid(unique);
		});

		it('when disabled, construction and insertArray skip duplicates', () => {
			const unique = new RedBlackTree<number>(byNumber, [2, 1, 2, 3, 1], {allowDuplicates: false});
			unique.insertArray([3, 4, 4]);

			expect(unique.values()).toEqual([1, 2, 3, 4]);
		});

		it('filter keeps the setting', () => {
			const unique = new RedBlackTree<number>(byNumber, [1, 2], {allowDuplicates: false});
			const copy = unique.filter(() => true);

			expect(copy.allowDuplicates).toBe(false);
			expect(copy.insert(1)).toBe('duplicate_not_allowed');
		});
	});

	describe('update', () => {
		type Entry = {k: number; id: string};
		const byKey = (a: Entry, b: Entry): number => a.k - b.k;
		const keysOf = (source: RedBlackTree<Entry>): number[] => source.values().map((e) => e.k);

		it('keeps the node in place when the position is still valid', () => {
			const keyed = new RedBlackTree<Entry>(byKey);
			keyed.insertArray([
				{k: 50, id: 'a'},
				{k: 30, id: 'b'},
				{k: 70, id: 'c'}
			]);
			const node = keyed.find({k: 30, id: ''})!;
			const item = node.value()!;
			item.k = 40;

			expect(keyed.update(node, item)).toBe(node);
			expect(keyed.root()?.left()).toBe(node);
			expect(keysOf(keyed)).toEqual([40, 50, 70]);
			expectValid(keyed);
		});

		it('moves an item changed in place that no longer fits', () => {
			const keyed = new RedBlackTree<Entry>(byKey);
			keyed.insertArray([50, 30, 70, 20, 40, 60, 80].map((k) => ({k, id: String(k)})));
			const node = keyed.find({k: 30, id: ''})!;
			const item = node.value()!;
			item.k = 65;

			const result = keyed.update(node, item) as RedBlackTreeElement<Entry>;

			expect(result).toBeInstanceOf(RedBlackTreeElement);
			expect(result.value()).toBe(item);
			expect(keyed.size()).toBe(7);
			expect(keysOf(keyed)).toEqual([20, 40, 50, 60, 65, 70, 80]);
			expectValid(keyed);
		});

		it('replaces the item with a new one', () => {
			const numbers = new RedBlackTree<number>(byNumber, [50, 30, 70]);
			const node = numbers.find(50)!;
			const result = numbers.update(node, 10) as RedBlackTreeElement<number>;

			expect(result.value()).toBe(10);
			expect(numbers.values()).toEqual([10, 30, 70]);
			expectValid(numbers);
		});

		it('detects every kind of misplacement', () => {
			const start = [50, 30, 70, 20, 40, 60, 80];
			const cases: [number, number][] = [
				[50, 10],
				[50, 90],
				[30, 45],
				[30, 15],
				[40, 55],
				[40, 25],
				[60, 45],
				[60, 75],
				[20, 30],
				[40, 50],
				[80, 70]
			];

			for (const [from, to] of cases) {
				const numbers = new RedBlackTree<number>(byNumber, start);
				numbers.update(numbers.find(from), to);

				const expected = start
					.filter((v) => v !== from)
					.concat(to)
					.sort(byNumber);
				expect(numbers.values()).toEqual(expected);
				expectValid(numbers);
			}
		});

		it('keeps equal items after existing ones when moved', () => {
			const keyed = new RedBlackTree<Entry>(byKey);
			const a = {k: 1, id: 'a'};
			const b = {k: 1, id: 'b'};
			const c = {k: 5, id: 'c'};
			keyed.insertArray([a, b, c]);
			const nodeC = keyed.find(c)!;
			c.k = 1;
			keyed.update(nodeC, c);

			expect(keyed.values()).toEqual([a, b, c]);
			expectValid(keyed);
		});

		it('when duplicates are disabled, removes an item that now equals another', () => {
			const unique = new RedBlackTree<number>(byNumber, [50, 30, 70], {allowDuplicates: false});

			expect(unique.update(unique.find(30), 70)).toBe('duplicate_not_allowed');
			expect(unique.values()).toEqual([50, 70]);
			expect(unique.update(unique.find(70), 50)).toBe('duplicate_not_allowed');
			expect(unique.values()).toEqual([50]);
			expectValid(unique);
		});

		it('compares against each neighbor only once when the item stays in place', () => {
			for (const allowDuplicates of [true, false]) {
				let calls = 0;
				const counted = new RedBlackTree<number>(
					(a, b) => {
						calls++;
						return a - b;
					},
					[10, 20, 30, 40, 50],
					{allowDuplicates}
				);
				const node = counted.find(30)!;
				calls = 0;

				expect(counted.update(node, 31)).toBe(node);
				expect(calls).toBe(2);
			}
		});

		it('when duplicates are disabled, accepts an item still unique', () => {
			const unique = new RedBlackTree<number>(byNumber, [50, 30, 70], {allowDuplicates: false});
			const node = unique.find(30);

			expect(unique.update(node, 40)).toBe(node);
			expect((unique.update(node, 90) as RedBlackTreeElement<number>).value()).toBe(90);
			expect(unique.values()).toEqual([50, 70, 90]);
		});

		it('relinks the same node when the item moves, keeping its identity and link id', () => {
			const cases: [number, number][] = [
				[50, 10],
				[50, 90],
				[30, 65],
				[20, 85],
				[80, 5],
				[40, 55]
			];

			for (const [from, to] of cases) {
				const numbers = new RedBlackTree<number>(byNumber, [50, 30, 70, 20, 40, 60, 80]);
				const node = numbers.find(from)!;
				const linkId = node._linkId;
				const inUse = poolOf(numbers)!.size();

				expect(numbers.update(node, to)).toBe(node);
				expect(node._tree).toBe(numbers);
				expect(node._linkId).toBe(linkId);
				expect(numbers.find(to)).toBe(node);
				expect(numbers.size()).toBe(7);
				expect(poolOf(numbers)!.size()).toBe(inUse);
				expectValid(numbers);
			}
		});

		it('moving an item neither releases nor allocates a node', () => {
			const numbers = new RedBlackTree<number>(byNumber, [50, 30, 70, 20, 40, 60, 80]);
			const nodes = new Set(numbers.toArray());

			for (let i = 0; i < 100; i++) {
				const node = numbers.min()!;
				numbers.update(node, (numbers.max()!.value() as number) + 1);
				expectValid(numbers);
			}

			expect(new Set(numbers.toArray())).toEqual(nodes);
			expect(numbers.size()).toBe(7);
		});

		it('keeps every red-black rule through many random moves', () => {
			let seed = 12345;
			const random = (): number => {
				seed = (seed * 1103515245 + 12345) % 2147483648;
				return seed / 2147483648;
			};

			for (const allowDuplicates of [true, false]) {
				const numbers = new RedBlackTree<number>(byNumber, [], {allowDuplicates});
				const nodes: RedBlackTreeElement<number>[] = [];

				for (let i = 0; i < 200; i++) {
					const result = numbers.insert(Math.floor(random() * 1000));
					if (typeof result !== 'string') {
						nodes.push(result);
					}
				}
				const linkIds = nodes.map((node) => node._linkId);
				expectValid(numbers);

				for (let i = 0; i < 2000; i++) {
					const index = Math.floor(random() * nodes.length);
					const node = nodes[index];
					const to = Math.floor(random() * 1000);
					const result = numbers.update(node, to);

					if (result === 'duplicate_not_allowed') {
						expect(allowDuplicates).toBe(false);
						expect(node._tree).toBeNull();
						nodes.splice(index, 1);
						linkIds.splice(index, 1);
					} else {
						expect(result).toBe(node);
						expect(node._linkId).toBe(linkIds[index]);
					}

					if (i % 50 === 0) {
						expectValid(numbers);
					}
				}

				expectValid(numbers);
				expect(numbers.size()).toBe(nodes.length);
				expect(numbers.values()).toEqual(nodes.map((node) => node.value() as number).sort(byNumber));
			}
		});

		it('query delete handles keep working after the item moves', () => {
			const numbers = new RedBlackTree<number>(byNumber, [50, 30, 70, 20, 40]);
			const [match] = numbers.query((v) => v === 30);

			numbers.update(match.element, 90);

			expect(match.delete()).toBe(90);
			expect(numbers.values()).toEqual([20, 40, 50, 70]);
			expectValid(numbers);
		});

		it('moves correctly with pooling disabled', () => {
			const plain = new RedBlackTree<number>(byNumber, [50, 30, 70, 20, 40, 60, 80], {
				disableElementPooling: true
			});
			const node = plain.find(30)!;
			const linkId = node._linkId;

			expect(plain.update(node, 75)).toBe(node);
			expect(node.value()).toBe(75);
			expect(node._tree).toBe(plain);
			expect(node._linkId).toBe(linkId);
			expect(plain.values()).toEqual([20, 40, 50, 60, 70, 75, 80]);
			expectValid(plain);
		});

		it('moving into a duplicate when duplicates are disabled drops and recycles the node', () => {
			const unique = new RedBlackTree<number>(byNumber, [50, 30, 70, 20], {allowDuplicates: false});
			const node = unique.find(20)!;

			expect(unique.update(node, 70)).toBe('duplicate_not_allowed');
			expect(node._tree).toBeNull();
			expect(unique.size()).toBe(3);
			expect(poolOf(unique)!.size()).toBe(3);
			expect(unique.insert(10)).toBe(node);
			expectValid(unique);
		});

		it('blanks a node dropped by a duplicate-rejected move with pooling disabled', () => {
			const plain = new RedBlackTree<number>(byNumber, [50, 30, 70, 20], {
				allowDuplicates: false,
				disableElementPooling: true
			});
			const node = plain.find(20)!;

			expect(plain.update(node, 70)).toBe('duplicate_not_allowed');
			expect(node.value()).toBeNull();
			expect(node._tree).toBeNull();
			expect(plain.values()).toEqual([30, 50, 70]);
			expectValid(plain);
		});

		it('returns null and changes nothing for null or foreign nodes', () => {
			const numbers = new RedBlackTree<number>(byNumber, [1, 2]);
			const foreign = new RedBlackTreeElement<number>(5);

			expect(numbers.update(null, 3)).toBeNull();
			expect(numbers.update(foreign, 3)).toBeNull();
			expect(foreign.value()).toBe(5);
			expect(numbers.values()).toEqual([1, 2]);
		});
	});

	describe('navigation', () => {
		beforeEach(() => tree.insertArray([50, 30, 70, 20, 40, 60, 80]));

		it('min and max', () => {
			expect(tree.min()?.value()).toBe(20);
			expect(tree.max()?.value()).toBe(80);
			expect(new RedBlackTree(byNumber).min()).toBeNull();
			expect(new RedBlackTree(byNumber).max()).toBeNull();
		});

		it('successor walks forward in sorted order', () => {
			const walked: number[] = [];
			let node = tree.min();
			while (node) {
				walked.push(node.value() as number);
				node = tree.successor(node);
			}

			expect(walked).toEqual([20, 30, 40, 50, 60, 70, 80]);
		});

		it('predecessor walks backward in sorted order', () => {
			const walked: number[] = [];
			let node = tree.max();
			while (node) {
				walked.push(node.value() as number);
				node = tree.predecessor(node);
			}

			expect(walked).toEqual([80, 70, 60, 50, 40, 30, 20]);
		});

		it('successor / predecessor return null for foreign nodes', () => {
			const foreign = new RedBlackTree<number>(byNumber, [1]).root();

			expect(tree.successor(null)).toBeNull();
			expect(tree.successor(foreign)).toBeNull();
			expect(tree.predecessor(null)).toBeNull();
			expect(tree.predecessor(foreign)).toBeNull();
		});

		it('height, depth, and black height', () => {
			expect(new RedBlackTree(byNumber).height()).toBe(-1);
			expect(new RedBlackTree(byNumber, [1]).height()).toBe(0);
			expect(new RedBlackTree(byNumber).blackHeight()).toBe(0);
			expect(new RedBlackTree(byNumber, [1]).blackHeight()).toBe(1);
			expect(tree.height()).toBe(2);
			expect(tree.blackHeight()).toBe(2);
			expect(tree.depth(tree.root())).toBe(0);
			expect(tree.depth(tree.find(40))).toBe(2);
			expect(tree.depth(null)).toBeNull();
			expect(tree.depth(new RedBlackTreeElement(40))).toBeNull();
		});
	});

	describe('traversal', () => {
		beforeEach(() => tree.insertArray([50, 30, 70, 20, 40, 60, 80]));

		it('in order', () => {
			expect(tree.inOrder()).toEqual([20, 30, 40, 50, 60, 70, 80]);
			expect(tree.values()).toEqual(tree.inOrder());
		});

		it('pre order', () => {
			expect(tree.preOrder()).toEqual([50, 30, 20, 40, 70, 60, 80]);
		});

		it('post order', () => {
			expect(tree.postOrder()).toEqual([20, 40, 30, 60, 80, 70, 50]);
		});

		it('level order', () => {
			expect(tree.levelOrder()).toEqual([50, 30, 70, 20, 40, 60, 80]);
		});

		it('empty tree traversals are empty', () => {
			const empty = new RedBlackTree<number>(byNumber);

			expect(empty.inOrder()).toEqual([]);
			expect(empty.preOrder()).toEqual([]);
			expect(empty.postOrder()).toEqual([]);
			expect(empty.levelOrder()).toEqual([]);
			expect(empty.toArray()).toEqual([]);
		});

		it('iterates in sorted order', () => {
			expect(tree[Symbol.iterator]()).toBeInstanceOf(RedBlackTreeIterator);
			expect([...tree]).toEqual([20, 30, 40, 50, 60, 70, 80]);
			expect([...new RedBlackTree(byNumber)]).toEqual([]);
		});

		it('toArray returns nodes in sorted order', () => {
			expect(tree.toArray().map((node) => node.value())).toEqual([20, 30, 40, 50, 60, 70, 80]);
		});

		it('every order and height match a recursive reference on random trees', () => {
			type Node = RedBlackTreeElement<number> | null;
			const pre = (n: Node, out: number[]): number[] => {
				if (n) {
					out.push(n.value() as number);
					pre(n.left(), out);
					pre(n.right(), out);
				}
				return out;
			};
			const post = (n: Node, out: number[]): number[] => {
				if (n) {
					post(n.left(), out);
					post(n.right(), out);
					out.push(n.value() as number);
				}
				return out;
			};
			const heightOf = (n: Node): number =>
				n ? 1 + Math.max(heightOf(n.left()), heightOf(n.right())) : -1;
			let seed = 7;
			const random = (): number => {
				seed = (seed * 16807) % 2147483647;
				return seed;
			};

			for (let count = 0; count < 60; count++) {
				const source = new RedBlackTree<number>(byNumber);
				for (let i = 0; i < count; i++) {
					source.insert(random() % 50);
				}
				for (let i = 0; i < count / 3; i++) {
					source.remove(random() % 50);
				}
				const root = source.root();
				const level: number[] = [];
				const queue: Node[] = [root];
				while (queue.length) {
					const n = queue.shift();
					if (n) {
						level.push(n.value() as number);
						queue.push(n.left(), n.right());
					}
				}

				expect(source.preOrder()).toEqual(pre(root, []));
				expect(source.postOrder()).toEqual(post(root, []));
				expect(source.levelOrder()).toEqual(level);
				expect(source.inOrder()).toEqual([...source.inOrder()].sort(byNumber));
				expect(source.height()).toBe(heightOf(root));
			}
		});

		it('height does not build arrays or call toArray', () => {
			const spy = jest.spyOn(tree, 'toArray');

			expect(tree.height()).toBe(2);
			expect(tree.inOrder()).toEqual([20, 30, 40, 50, 60, 70, 80]);
			expect(spy).not.toHaveBeenCalled();
			spy.mockRestore();
		});

		it('iterator reuses one result object per iterator', () => {
			const iterator = tree[Symbol.iterator]();
			const first = iterator.next();

			expect(first).toEqual({value: 20, done: false});
			const second = iterator.next();

			expect(second).toBe(first);
			expect(second).toEqual({value: 30, done: false});
			for (let i = 0; i < 5; i++) {
				iterator.next();
			}
			const done = iterator.next();

			expect(done).toBe(first);
			expect(done).toEqual({value: null, done: true});
			expect(iterator.next()).toEqual({value: null, done: true});
			expect(tree[Symbol.iterator]().next()).not.toBe(first);
		});

		it('nested loops over the same tree stay independent', () => {
			const pairs: number[] = [];
			for (const a of new RedBlackTree(byNumber, [1, 2])) {
				for (const b of new RedBlackTree(byNumber, [3, 4])) {
					pairs.push((a as number) * 10 + (b as number));
				}
			}

			expect(pairs).toEqual([13, 14, 23, 24]);
		});
	});

	describe('forEach', () => {
		beforeEach(() => tree.insertArray([2, 1, 3]));

		it('visits elements in sorted order with index and tree', () => {
			const seen: [number | null, number][] = [];
			tree.forEach((element, index, source) => {
				expect(source).toBe(tree);
				seen.push([element.value(), index]);
			});

			expect(seen).toEqual([
				[1, 0],
				[2, 1],
				[3, 2]
			]);
		});

		it('passes thisArg as given', () => {
			const context = {};
			let received: unknown = null;
			tree.forEach(function (this: unknown) {
				// eslint-disable-next-line @typescript-eslint/no-this-alias
				received = this;
			}, context);

			expect(received).toBe(context);
		});

		it('allows removing the current element', () => {
			tree.insertArray([5, 4, 6, 7, 8, 9, 10, 11, 12]);
			tree.forEach((element) => {
				if ((element.value() as number) % 2 === 0) {
					tree.removeNode(element);
				}
			});

			expect(tree.values()).toEqual([1, 3, 5, 7, 9, 11]);
			expectValid(tree);
		});

		it('returns the tree', () => {
			expect(tree.forEach(() => undefined)).toBe(tree);
		});
	});

	describe('filter', () => {
		it('returns a new balanced tree of matching items', () => {
			for (let i = 1; i <= 15; i++) {
				tree.insert(i);
			}
			const odds = tree.filter((element) => (element.value() as number) % 2 === 1);

			expect(odds).toBeInstanceOf(RedBlackTree);
			expect(odds).not.toBe(tree);
			expect(odds.values()).toEqual([1, 3, 5, 7, 9, 11, 13, 15]);
			expect(odds.height()).toBe(3);
			expect(odds.comparator).toBe(tree.comparator);
			expect(tree.size()).toBe(15);
			expectValid(odds);
		});

		it('builds a valid tree for every size', () => {
			for (let count = 0; count <= 130; count++) {
				const source = new RedBlackTree<number>(
					byNumber,
					new Array(count).fill(0).map((_, i) => i)
				);
				const copy = source.filter(() => true);

				expect(copy.values()).toEqual(source.values());
				expect(copy.height()).toBe(count > 0 ? Math.floor(Math.log2(count)) : -1);
				expectValid(copy);

				copy.insert(count / 2);
				copy.remove(0);
				expectValid(copy);
			}
		});

		it('keeps equal items in order in the balanced result', () => {
			const byKey = (a: {k: number}, b: {k: number}): number => a.k - b.k;
			const keyed = new RedBlackTree<{k: number}>(byKey);
			const items = [{k: 1}, {k: 1}, {k: 1}, {k: 1}, {k: 1}];
			keyed.insertArray(items);
			const copy = keyed.filter(() => true);

			expect(copy.values()).toEqual(items);
			expect(copy.values()[0]).toBe(items[0]);
			expect(copy.values()[4]).toBe(items[4]);
			expect(copy.find({k: 1})?.value()).toBe(items[0]);
			expectValid(copy);
			copy.insert({k: 1});
			expectValid(copy);
		});

		it('builds large trees without recursion', () => {
			const count = 20000;
			const source = new RedBlackTree<number>(byNumber, [], {disableElementPooling: true});
			for (let i = 0; i < count; i++) {
				source.insert(i);
			}
			const copy = source.filter(() => true);

			expect(copy.size()).toBe(count);
			expect(copy.height()).toBe(Math.floor(Math.log2(count)));
			expect(copy.min()?.value()).toBe(0);
			expect(copy.max()?.value()).toBe(count - 1);
			expectValid(copy);
		});

		it('passes index and tree and honors thisArg', () => {
			tree.insertArray([3, 1, 2]);
			const ctx = {min: 2};
			const seen: number[] = [];
			const result = tree.filter(function (this: typeof ctx, element, index, source) {
				expect(source).toBe(tree);
				seen.push(index);
				return (element.value() as number) >= this.min;
			}, ctx);

			expect(seen).toEqual([0, 1, 2]);
			expect(result.values()).toEqual([2, 3]);
		});

		it('returns an empty tree when nothing matches', () => {
			tree.insertArray([1, 2]);

			expect(tree.filter(() => false).size()).toBe(0);
		});
	});

	describe('query', () => {
		beforeEach(() => tree.insertArray([50, 30, 70, 20, 40]));

		it('matches in sorted order', () => {
			const results = tree.query((v) => v > 25);

			expect(results.map((r) => r.element.value())).toEqual([30, 40, 50, 70]);
			expect(results[0].index()).toBeNull();
			expect(results[0].key()).toBeNull();
		});

		it('requires every filter in an array', () => {
			expect(tree.query([(v) => v > 25, (v) => v < 60]).map((r) => r.element.value())).toEqual([
				30, 40, 50
			]);
			expect(tree.query([])).toEqual([]);
		});

		it('respects the limit', () => {
			expect(tree.query(() => true, {limit: 2}).map((r) => r.element.value())).toEqual([20, 30]);
			expect(tree.query(() => true, {limit: 0}).length).toBe(5);
			expect(tree.query(() => true, {limit: NaN}).length).toBe(5);
			expect(tree.query(() => true, {limit: -3}).length).toBe(5);
			expect(tree.query(() => true, {limit: '2' as any}).length).toBe(5);
			expect(tree.query(() => true, {limit: 2.4}).length).toBe(2);
			expect(tree.query(() => true, {limit: Infinity}).length).toBe(5);
			expect(tree.query(() => true, null as any).length).toBe(5);
		});

		it('shares key and index functions across results', () => {
			const results = tree.query(() => true);

			expect(results.length).toBe(5);
			for (const result of results) {
				expect(result.key).toBe(results[0].key);
				expect(result.index).toBe(results[0].index);
			}
		});

		it('stops at the first failing filter in an array', () => {
			const second = jest.fn(() => true);
			tree.query([(v) => v > 40, second]);

			expect(second).toHaveBeenCalledTimes(2);
		});

		it('delete works when detached from its result', () => {
			const [match] = tree.query((v) => v === 40);
			const {delete: remove} = match;

			expect(remove()).toBe(40);
			expect(remove()).toBeNull();
			expect(tree.values()).toEqual([20, 30, 50, 70]);
		});

		it('delete removes the match once', () => {
			const [match] = tree.query((v) => v === 30);

			expect(match.delete()).toBe(30);
			expect(match.delete()).toBeNull();
			expect(tree.values()).toEqual([20, 40, 50, 70]);
			expectValid(tree);
		});

		it('stale delete does not remove the item that reused its node', () => {
			const pooled = new RedBlackTree<number>(byNumber, [50, 30, 70, 20, 40]);
			const [match] = pooled.query((v) => v === 20);

			expect(match.delete()).toBe(20);
			const reused = pooled.insert(10);

			expect(reused).toBe(match.element);
			expect(match.delete()).toBeNull();
			expect(pooled.values()).toEqual([10, 30, 40, 50, 70]);
		});
	});

	describe('stringify', () => {
		it('serializes items in sorted order', () => {
			tree.insertArray([2, 1, 3]);

			expect(JSON.parse(tree.stringify() as string)).toEqual({
				type: 'RedBlackTree',
				elements: [1, 2, 3]
			});
		});

		it('returns null for items that cannot be serialized', () => {
			const big = new RedBlackTree<bigint>((a, b) => Number(a - b), [BigInt(1)]);

			expect(big.stringify()).toBeNull();
		});
	});

	describe('clearElements / reset', () => {
		it('unlinks every element and empties the tree', () => {
			tree.insertArray([2, 1, 3]);
			const nodes = tree.toArray();
			tree.clearElements();

			expect(tree.size()).toBe(0);
			expect(tree.root()).toBeNull();
			for (const node of nodes) {
				expect(node._tree).toBeNull();
				expect(node.parent()).toBeNull();
				expect(node.isLeaf()).toBe(true);
			}
		});

		it('clears large trees by walking links, without building a node array', () => {
			const spy = jest.spyOn(tree, 'toArray');
			for (let i = 0; i < 1000; i++) {
				tree.insert((i * 7919) % 1000);
			}

			expect(tree.clearElements()).toBe(tree);
			expect(spy).not.toHaveBeenCalled();
			expect(tree.size()).toBe(0);
			expect(tree.root()).toBeNull();
			expect(tree.height()).toBe(-1);
			expect(poolOf(tree)!.size()).toBe(0);
			spy.mockRestore();

			tree.insertArray([3, 1, 2]);
			expect(tree.values()).toEqual([1, 2, 3]);
			expectValid(tree);
		});

		it('clears an empty tree', () => {
			expect(new RedBlackTree(byNumber).clearElements().size()).toBe(0);
		});

		it('reset keeps the comparator and returns the tree', () => {
			tree.insertArray([2, 1]);

			expect(tree.reset()).toBe(tree);
			expect(tree.comparator).toBe(byNumber);
			tree.insertArray([5, 4]);
			expect(tree.values()).toEqual([4, 5]);
		});
	});
});
