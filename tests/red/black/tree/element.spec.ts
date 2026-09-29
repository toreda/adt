import {RedBlackTree} from '../../../../src/red/black/tree';
import {RedBlackTreeElement} from '../../../../src/red/black/tree/element';

const byKey = (a: {k: number}, b: {k: number}): number => a.k - b.k;

describe('RedBlackTreeElement', () => {
	it('starts blank or with the given value', () => {
		const blank = new RedBlackTreeElement<number>();

		expect(blank.value()).toBeNull();
		expect(blank.parent()).toBeNull();
		expect(blank.children()).toEqual([]);
		expect(blank.isLeaf()).toBe(true);
		expect(blank.color()).toBe('red');
		expect(new RedBlackTreeElement(4).value()).toBe(4);
	});

	it('cleanObj resets every field to a fresh node', () => {
		const tree = new RedBlackTree<number>((a, b) => a - b, [2, 1, 3]);
		const root = tree.root() as RedBlackTreeElement<number>;
		expect(root.color()).toBe('black');
		root.cleanObj();

		expect(root).toEqual(new RedBlackTreeElement<number>());
	});

	it('children lists existing children left before right', () => {
		const tree = new RedBlackTree<number>((a, b) => a - b, [2, 1, 3]);
		const root = tree.root()!;

		expect(root.children().map((c) => c.value())).toEqual([1, 3]);
		expect(root.isLeaf()).toBe(false);
		expect(root.left()?.isLeaf()).toBe(true);
		expect(root.left()?.parent()).toBe(root);

		tree.remove(1);
		expect(root.children().map((c) => c.value())).toEqual([3]);
	});

	it('children fills and returns a given output array instead of allocating', () => {
		const tree = new RedBlackTree<number>((a, b) => a - b, [2, 1, 3]);
		const root = tree.root()!;
		const out: RedBlackTreeElement<number>[] = [root, root, root, root];

		expect(root.children(out)).toBe(out);
		expect(out.map((c) => c.value())).toEqual([1, 3]);
		expect(root.left()!.children(out)).toBe(out);
		expect(out).toEqual([]);
		expect(root.children(null as any).map((c) => c.value())).toEqual([1, 3]);
	});

	it('sets any value while unlinked', () => {
		const node = new RedBlackTreeElement<number>(1);

		expect(node.value(9)).toBeNull();
		expect(node.value()).toBe(9);
	});

	it('only accepts an equally ordered value while linked', () => {
		const tree = new RedBlackTree<{k: number; v: string}>(byKey, [
			{k: 2, v: 'b'},
			{k: 1, v: 'a'}
		]);
		const node = tree.find({k: 2, v: ''})!;
		const updated = {k: 2, v: 'updated'};

		node.value(updated);
		expect(node.value()).toBe(updated);

		node.value({k: 0, v: 'breaks order'});
		expect(node.value()).toBe(updated);
		expect(tree.values().map((item) => item.k)).toEqual([1, 2]);
	});
});
