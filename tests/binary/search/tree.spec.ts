import {BinarySearchTree} from '../../../src/binary/search/tree';
import {BinarySearchTreeElement} from '../../../src/binary/search/tree/element';
import {BinarySearchTreeIterator} from '../../../src/binary/search/tree/iterator';
import {ObjectPool} from '../../../src/object/pool';

const byNumber = (a: number, b: number): number => a - b;
const poolOf = (target: BinarySearchTree<any>): ObjectPool<any> | null => (target as any).elements.objectPool;

/**
 * Walk the whole tree and check every structural rule: parent links agree with
 * child links, left subtrees are strictly smaller, right subtrees are equal or
 * larger, every node is owned by the tree, and size matches the node count.
 */
const expectValid = <T>(tree: BinarySearchTree<T>): void => {
	const root = tree.root();
	let count = 0;

	if (root) {
		expect(root.parent()).toBeNull();
	}

	const stack: {node: BinarySearchTreeElement<T>; low: T | null; high: T | null}[] = root
		? [{node: root, low: null, high: null}]
		: [];

	while (stack.length) {
		const {node, low, high} = stack.pop()!;
		const value = node.value() as T;
		count++;

		expect(node._tree).toBe(tree);
		if (low !== null) {
			expect(tree.comparator(value, low)).toBeGreaterThanOrEqual(0);
		}
		if (high !== null) {
			expect(tree.comparator(value, high)).toBeLessThan(0);
		}

		const left = node.left();
		const right = node.right();

		if (left) {
			expect(left.parent()).toBe(node);
			stack.push({node: left, low, high: value});
		}
		if (right) {
			expect(right.parent()).toBe(node);
			stack.push({node: right, low: value, high});
		}
	}

	expect(tree.size()).toBe(count);
};

const tree = new BinarySearchTree<number>(byNumber);

describe('BinarySearchTree', () => {
	beforeEach(() => {
		tree.reset();
		expect(tree.isEmpty()).toBe(true);
	});

	describe('INSTANTIATION', () => {
		it('with only a comparator', () => {
			const result = new BinarySearchTree<number>(byNumber);

			expect(result).toBeInstanceOf(BinarySearchTree);
			expect(result.size()).toBe(0);
			expect(result.root()).toBeNull();
			expect(result.comparator).toBe(byNumber);
		});

		it('with items inserted in array order', () => {
			const result = new BinarySearchTree<number>(byNumber, [5, 3, 8]);

			expect(result.size()).toBe(3);
			expect(result.root()?.value()).toBe(5);
			expect(result.root()?.left()?.value()).toBe(3);
			expect(result.root()?.right()?.value()).toBe(8);
			expectValid(result);
		});

		it('does not keep a reference to the provided array', () => {
			const items = [1, 2, 3];
			const result = new BinarySearchTree<number>(byNumber, items);
			items.push(4);

			expect(result.size()).toBe(3);
		});

		it('throws without a comparator function', () => {
			expect(() => new BinarySearchTree<number>(undefined as any)).toThrow();
			expect(() => new BinarySearchTree<number>(null as any)).toThrow();
			expect(() => new BinarySearchTree<number>({} as any)).toThrow();
		});

		it('ignores invalid data and options instead of throwing', () => {
			expect(new BinarySearchTree(byNumber, 'adsf' as any).size()).toBe(0);
			expect(new BinarySearchTree(byNumber, null).size()).toBe(0);
			expect(new BinarySearchTree(byNumber, {elements: [4]} as any).size()).toBe(0);
			expect(new BinarySearchTree(byNumber, [1], null).size()).toBe(1);
			expect(new BinarySearchTree(byNumber, [1], 'nope' as any).size()).toBe(1);
		});
	});

	describe('ELEMENT POOLING', () => {
		it('is enabled by default', () => {
			expect(poolOf(new BinarySearchTree(byNumber))).toBeInstanceOf(ObjectPool);
		});

		it('only strict true disables it', () => {
			expect(poolOf(new BinarySearchTree(byNumber, [], {disableElementPooling: true}))).toBeNull();
			expect(
				poolOf(new BinarySearchTree(byNumber, [], {disableElementPooling: 'true' as any}))
			).toBeInstanceOf(ObjectPool);
		});

		it('recycles a removed node for a later insert', () => {
			const pooled = new BinarySearchTree<number>(byNumber);
			const first = pooled.insert(1) as BinarySearchTreeElement<number>;
			pooled.removeNode(first);

			const second = pooled.insert(2) as BinarySearchTreeElement<number>;

			expect(second).toBe(first);
			expect(second.value()).toBe(2);
			expect(pooled.values()).toEqual([2]);
		});

		it('reuses pooled nodes instead of allocating in steady state', () => {
			const pooled = new BinarySearchTree<number>(byNumber, [], {pool: {startSize: 4}});
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
			const plain = new BinarySearchTree<number>(byNumber, [], {disableElementPooling: true});
			const first = plain.insert(1) as BinarySearchTreeElement<number>;
			plain.removeNode(first);

			expect(plain.insert(2)).not.toBe(first);
			expect(first.value()).toBe(1);
			expect(first._tree).toBeNull();
		});

		it('behaves the same with pooling disabled', () => {
			const plain = new BinarySearchTree<number>(byNumber, [5, 3, 8, 1, 4], {
				disableElementPooling: true
			});

			expect(plain.remove(3)).toBe(3);
			expect(plain.values()).toEqual([1, 4, 5, 8]);
			expectValid(plain);
			expect(plain.clearElements().size()).toBe(0);
		});

		it('filter keeps the pooling options', () => {
			const plain = new BinarySearchTree<number>(byNumber, [1, 2], {disableElementPooling: true});

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
			const node = tree.insert(7) as BinarySearchTreeElement<number>;

			expect(node).toBeInstanceOf(BinarySearchTreeElement);
			expect(node.value()).toBe(7);
			expect(tree.root()).toBe(node);
		});

		it('places equal items after existing ones', () => {
			const byKey = (a: {k: number}, b: {k: number}): number => a.k - b.k;
			const keyed = new BinarySearchTree<{k: number; id: string}>(byKey);
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

		it('stores null and undefined items as given', () => {
			const anything = new BinarySearchTree<number | null | undefined>(() => 0);
			anything.insertArray([null, undefined, 3]);

			expect(anything.values()).toEqual([null, undefined, 3]);
			expect(anything.size()).toBe(3);
		});

		it('insertArray ignores non-arrays', () => {
			tree.insertArray(null);
			tree.insertArray('abc' as any);

			expect(tree.size()).toBe(0);
		});

		it('handles a degenerate tree without overflowing the stack', () => {
			const count = 15000;
			for (let i = 0; i < count; i++) {
				tree.insert(i);
			}

			expect(tree.height()).toBe(count - 1);
			expect(tree.values().length).toBe(count);
			expect(tree.preOrder().length).toBe(count);
			expect(tree.postOrder().length).toBe(count);
			expect(tree.levelOrder().length).toBe(count);
			expect(tree.depth(tree.max())).toBe(count - 1);
			expect(tree.clearElements().size()).toBe(0);
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
			expect(new BinarySearchTree(byNumber).find(1)).toBeNull();
		});
	});

	describe('remove / removeNode', () => {
		beforeEach(() => tree.insertArray([50, 30, 70, 20, 40, 60, 80, 35, 45]));

		it('removes a leaf', () => {
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

		it('removes a node with two children whose successor is its right child', () => {
			expect(tree.remove(70)).toBe(70);
			expect(tree.root()?.right()?.value()).toBe(80);
			expect(tree.values()).toEqual([20, 30, 35, 40, 45, 50, 60, 80]);
			expectValid(tree);
		});

		it('removes a node with two children whose successor is deeper', () => {
			expect(tree.remove(30)).toBe(30);
			expect(tree.root()?.left()?.value()).toBe(35);
			expect(tree.values()).toEqual([20, 35, 40, 45, 50, 60, 70, 80]);
			expectValid(tree);
		});

		it('removes the root', () => {
			expect(tree.remove(50)).toBe(50);
			expect(tree.root()?.value()).toBe(60);
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
		});

		it('keeps other node handles holding their items', () => {
			const node60 = tree.find(60)!;
			const node80 = tree.find(80)!;
			tree.remove(70);

			expect(node60.value()).toBe(60);
			expect(node80.value()).toBe(80);
			expect(tree.find(60)).toBe(node60);
		});

		it('returns null for absent items and foreign or stale nodes', () => {
			const other = new BinarySearchTree<number>(byNumber, [20]);
			const node = tree.find(20)!;

			expect(tree.remove(99)).toBeNull();
			expect(tree.removeNode(null)).toBeNull();
			expect(tree.removeNode(other.root())).toBeNull();
			expect(tree.removeNode(new BinarySearchTreeElement(20))).toBeNull();
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
		});

		it('removes one of several equal items, the first in sorted order', () => {
			const byKey = (a: {k: number}, b: {k: number}): number => a.k - b.k;
			const keyed = new BinarySearchTree<{k: number}>(byKey);
			const a = {k: 1};
			const b = {k: 1};
			keyed.insertArray([a, {k: 0}, b, {k: 2}]);

			expect(keyed.remove({k: 1})).toBe(a);
			expect(keyed.remove({k: 1})).toBe(b);
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

			for (let i = 0; i < 2000; i++) {
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
			}

			expect(tree.values()).toEqual(mirror.sort(byNumber));
			expectValid(tree);
		});
	});

	describe('allowDuplicates', () => {
		it('defaults to true and only takes booleans', () => {
			expect(new BinarySearchTree(byNumber).allowDuplicates).toBe(true);
			expect(new BinarySearchTree(byNumber, [], {}).allowDuplicates).toBe(true);
			expect(new BinarySearchTree(byNumber, [], {allowDuplicates: true}).allowDuplicates).toBe(true);
			expect(new BinarySearchTree(byNumber, [], {allowDuplicates: false}).allowDuplicates).toBe(false);
			for (const invalid of [0, 1, 'false', null, undefined, {}]) {
				expect(
					new BinarySearchTree(byNumber, [], {allowDuplicates: invalid as any}).allowDuplicates
				).toBe(true);
			}
		});

		it('when disabled, insert returns an error code and adds nothing', () => {
			const unique = new BinarySearchTree<number>(byNumber, [5, 3, 8], {allowDuplicates: false});
			const allocatedBefore = poolOf(unique)!.size();

			expect(unique.insert(3)).toBe('duplicate_not_allowed');
			expect(unique.insert(8)).toBe('duplicate_not_allowed');
			expect(unique.size()).toBe(3);
			expect(poolOf(unique)!.size()).toBe(allocatedBefore);
			expect(unique.insert(4)).toBeInstanceOf(BinarySearchTreeElement);
			expect(unique.values()).toEqual([3, 4, 5, 8]);
			expectValid(unique);
		});

		it('when disabled, construction and insertArray skip duplicates', () => {
			const unique = new BinarySearchTree<number>(byNumber, [2, 1, 2, 3, 1], {allowDuplicates: false});
			unique.insertArray([3, 4, 4]);

			expect(unique.values()).toEqual([1, 2, 3, 4]);
		});

		it('filter keeps the setting', () => {
			const unique = new BinarySearchTree<number>(byNumber, [1, 2], {allowDuplicates: false});
			const copy = unique.filter(() => true);

			expect(copy.allowDuplicates).toBe(false);
			expect(copy.insert(1)).toBe('duplicate_not_allowed');
		});
	});

	describe('update', () => {
		type Entry = {k: number; id: string};
		const byKey = (a: Entry, b: Entry): number => a.k - b.k;
		const keysOf = (source: BinarySearchTree<Entry>): number[] => source.values().map((e) => e.k);

		it('keeps the node in place when the position is still valid', () => {
			const keyed = new BinarySearchTree<Entry>(byKey);
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
			const keyed = new BinarySearchTree<Entry>(byKey);
			keyed.insertArray([50, 30, 70, 20, 40, 60, 80].map((k) => ({k, id: String(k)})));
			const node = keyed.find({k: 30, id: ''})!;
			const item = node.value()!;
			item.k = 65;

			const result = keyed.update(node, item) as BinarySearchTreeElement<Entry>;

			expect(result).toBeInstanceOf(BinarySearchTreeElement);
			expect(result.value()).toBe(item);
			expect(keyed.size()).toBe(7);
			expect(keysOf(keyed)).toEqual([20, 40, 50, 60, 65, 70, 80]);
			expectValid(keyed);
		});

		it('replaces the item with a new one', () => {
			const numbers = new BinarySearchTree<number>(byNumber, [50, 30, 70]);
			const node = numbers.find(50)!;
			const result = numbers.update(node, 10) as BinarySearchTreeElement<number>;

			expect(result.value()).toBe(10);
			expect(numbers.values()).toEqual([10, 30, 70]);
			expectValid(numbers);
		});

		it('detects every kind of misplacement', () => {
			const build = () => new BinarySearchTree<number>(byNumber, [50, 30, 70, 20, 40, 60, 80]);
			// Each case moves one node past a neighbour, a subtree bound, or an ancestor bound.
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
				const numbers = build();
				numbers.update(numbers.find(from), to);

				const expected = [50, 30, 70, 20, 40, 60, 80]
					.filter((v) => v !== from)
					.concat(to)
					.sort(byNumber);
				expect(numbers.values()).toEqual(expected);
				expectValid(numbers);
			}
		});

		it('keeps equal items after existing ones when moved', () => {
			const keyed = new BinarySearchTree<Entry>(byKey);
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
			const unique = new BinarySearchTree<number>(byNumber, [50, 30, 70], {allowDuplicates: false});

			expect(unique.update(unique.find(30), 70)).toBe('duplicate_not_allowed');
			expect(unique.values()).toEqual([50, 70]);
			expect(unique.update(unique.find(70), 50)).toBe('duplicate_not_allowed');
			expect(unique.values()).toEqual([50]);
			expectValid(unique);
		});

		it('when duplicates are disabled, accepts an item still unique', () => {
			const unique = new BinarySearchTree<number>(byNumber, [50, 30, 70], {allowDuplicates: false});
			const node = unique.find(30);

			expect(unique.update(node, 40)).toBe(node);
			expect((unique.update(node, 90) as BinarySearchTreeElement<number>).value()).toBe(90);
			expect(unique.values()).toEqual([50, 70, 90]);
		});

		it('returns null and changes nothing for null or foreign nodes', () => {
			const numbers = new BinarySearchTree<number>(byNumber, [1, 2]);
			const foreign = new BinarySearchTreeElement<number>(5);

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
			expect(new BinarySearchTree(byNumber).min()).toBeNull();
			expect(new BinarySearchTree(byNumber).max()).toBeNull();
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
			const foreign = new BinarySearchTree<number>(byNumber, [1]).root();

			expect(tree.successor(null)).toBeNull();
			expect(tree.successor(foreign)).toBeNull();
			expect(tree.predecessor(null)).toBeNull();
			expect(tree.predecessor(foreign)).toBeNull();
		});

		it('height and depth', () => {
			expect(new BinarySearchTree(byNumber).height()).toBe(-1);
			expect(new BinarySearchTree(byNumber, [1]).height()).toBe(0);
			expect(tree.height()).toBe(2);
			expect(tree.depth(tree.root())).toBe(0);
			expect(tree.depth(tree.find(40))).toBe(2);
			expect(tree.depth(null)).toBeNull();
			expect(tree.depth(new BinarySearchTreeElement(40))).toBeNull();
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

		it('pre order rebuilds the same shape', () => {
			const copy = new BinarySearchTree<number>(byNumber, tree.preOrder());

			expect(copy.levelOrder()).toEqual(tree.levelOrder());
		});

		it('post order', () => {
			expect(tree.postOrder()).toEqual([20, 40, 30, 60, 80, 70, 50]);
		});

		it('level order', () => {
			expect(tree.levelOrder()).toEqual([50, 30, 70, 20, 40, 60, 80]);
		});

		it('empty tree traversals are empty', () => {
			const empty = new BinarySearchTree<number>(byNumber);

			expect(empty.inOrder()).toEqual([]);
			expect(empty.preOrder()).toEqual([]);
			expect(empty.postOrder()).toEqual([]);
			expect(empty.levelOrder()).toEqual([]);
			expect(empty.toArray()).toEqual([]);
		});

		it('iterates in sorted order', () => {
			expect(tree[Symbol.iterator]()).toBeInstanceOf(BinarySearchTreeIterator);
			expect([...tree]).toEqual([20, 30, 40, 50, 60, 70, 80]);
			expect([...new BinarySearchTree(byNumber)]).toEqual([]);
		});

		it('toArray returns nodes in sorted order', () => {
			expect(tree.toArray().map((node) => node.value())).toEqual([20, 30, 40, 50, 60, 70, 80]);
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
				received = this;
			}, context);

			expect(received).toBe(context);
		});

		it('allows removing the current element', () => {
			tree.insertArray([5, 4, 6]);
			tree.forEach((element) => {
				if ((element.value() as number) % 2 === 0) {
					tree.removeNode(element);
				}
			});

			expect(tree.values()).toEqual([1, 3, 5]);
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

			expect(odds).toBeInstanceOf(BinarySearchTree);
			expect(odds).not.toBe(tree);
			expect(odds.values()).toEqual([1, 3, 5, 7, 9, 11, 13, 15]);
			expect(odds.height()).toBe(3);
			expect(odds.comparator).toBe(tree.comparator);
			expect(tree.size()).toBe(15);
			expectValid(odds);
		});

		it('keeps equal items in order in the balanced result', () => {
			const byKey = (a: {k: number}, b: {k: number}): number => a.k - b.k;
			const keyed = new BinarySearchTree<{k: number}>(byKey);
			const items = [{k: 1}, {k: 1}, {k: 1}, {k: 1}, {k: 1}];
			keyed.insertArray(items);
			const copy = keyed.filter(() => true);

			expect(copy.values()).toEqual(items);
			expect(copy.values()[0]).toBe(items[0]);
			expect(copy.values()[4]).toBe(items[4]);
			expectValid(copy);
			copy.insert({k: 1});
			expectValid(copy);
		});

		it('never places an equal item in a left subtree', () => {
			tree.insertArray([5, 1, 3, 3, 3, 3, 2, 3, 4, 3, 3, 6, 0]);
			const copy = tree.filter(() => true);

			expect(copy.values()).toEqual(tree.values());
			expect(copy.find(3)).toBe(copy.toArray()[3]);
			expectValid(copy);
		});

		it('handles many equal items without overflowing the stack', () => {
			const count = 12000;
			const same = new BinarySearchTree<number>(
				() => 0,
				new Array(count).fill(0).map((_, i) => i)
			);
			const copy = same.filter(() => true);

			expect(copy.values()).toEqual(same.values());
			expect(copy.height()).toBe(count - 1);
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
		});

		it('delete removes the match once', () => {
			const [match] = tree.query((v) => v === 30);

			expect(match.delete()).toBe(30);
			expect(match.delete()).toBeNull();
			expect(tree.values()).toEqual([20, 40, 50, 70]);
			expectValid(tree);
		});

		it('stale delete does not remove the item that reused its node', () => {
			const pooled = new BinarySearchTree<number>(byNumber, [50, 30, 70, 20, 40]);
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
				type: 'BinarySearchTree',
				elements: [1, 2, 3]
			});
		});

		it('returns null for items that cannot be serialized', () => {
			const big = new BinarySearchTree<bigint>((a, b) => Number(a - b), [BigInt(1)]);

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

		it('reset keeps the comparator and returns the tree', () => {
			tree.insertArray([2, 1]);

			expect(tree.reset()).toBe(tree);
			expect(tree.comparator).toBe(byNumber);
			tree.insertArray([5, 4]);
			expect(tree.values()).toEqual([4, 5]);
		});
	});
});
