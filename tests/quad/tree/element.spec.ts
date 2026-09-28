import {QuadTree} from '../../../src/quad/tree';
import {QuadTreeElement} from '../../../src/quad/tree/element';

interface Pt {
	x: number;
	y: number;
	v?: string;
}

const byPoint = (item: Pt): Pt => item;

describe('QuadTreeElement', () => {
	it('starts blank or with the given value', () => {
		const blank = new QuadTreeElement<Pt>();

		expect(blank.value()).toBeNull();
		expect(blank.parent()).toBeNull();
		expect(blank.children()).toEqual([]);
		expect(blank.isLeaf()).toBe(true);
		expect(blank.quadrant()).toBe(0);
		expect(blank.x()).toBe(0);
		expect(blank.y()).toBe(0);
		expect(new QuadTreeElement(4).value()).toBe(4);
	});

	it('cleanObj resets every field to a fresh node', () => {
		const tree = new QuadTree<Pt>(byPoint, [
			{x: 0, y: 0},
			{x: 1, y: 1},
			{x: -1, y: -1}
		]);
		const root = tree.root() as QuadTreeElement<Pt>;
		const child = root.child(3) as QuadTreeElement<Pt>;
		expect(child.quadrant()).toBe(3);
		root.cleanObj();
		child.cleanObj();

		expect(root).toEqual(new QuadTreeElement<Pt>());
		expect(child).toEqual(new QuadTreeElement<Pt>());
	});

	it('children lists existing children in quadrant order', () => {
		const tree = new QuadTree<Pt>(byPoint, [
			{x: 0, y: 0},
			{x: -1, y: -1},
			{x: 1, y: -1},
			{x: -1, y: 1}
		]);
		const root = tree.root()!;

		expect(root.children().map((c) => c.quadrant())).toEqual([1, 2, 3]);
		expect(root.child(0)).toBeNull();
		expect(root.child(9 as any)).toBeNull();
		expect(root.isLeaf()).toBe(false);
		expect(root.child(1)?.isLeaf()).toBe(true);
		expect(root.child(1)?.parent()).toBe(root);

		tree.removeNode(root.child(2));
		expect(root.children().map((c) => c.quadrant())).toEqual([1, 3]);
	});

	it('sets any value while unlinked', () => {
		const node = new QuadTreeElement<Pt>({x: 1, y: 1});
		const next = {x: 9, y: 9};

		expect(node.value(next)).toBeNull();
		expect(node.value()).toBe(next);
	});

	it('only accepts a value at the same position while linked', () => {
		const tree = new QuadTree<Pt>(byPoint, [
			{x: 2, y: 2, v: 'b'},
			{x: 1, y: 1, v: 'a'}
		]);
		const node = tree.find({x: 2, y: 2})!;
		const updated = {x: 2, y: 2, v: 'updated'};

		node.value(updated);
		expect(node.value()).toBe(updated);

		node.value({x: 0, y: 0, v: 'breaks order'});
		expect(node.value()).toBe(updated);
		expect(node.x()).toBe(2);
	});
});
