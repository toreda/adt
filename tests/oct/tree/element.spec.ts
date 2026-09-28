import {OctTree} from '../../../src/oct/tree';
import {OctTreeElement} from '../../../src/oct/tree/element';

interface Pt {
	x: number;
	y: number;
	z: number;
	v?: string;
}

const byPoint = (item: Pt): Pt => item;

describe('OctTreeElement', () => {
	it('starts blank or with the given value', () => {
		const blank = new OctTreeElement<Pt>();

		expect(blank.value()).toBeNull();
		expect(blank.parent()).toBeNull();
		expect(blank.children()).toEqual([]);
		expect(blank.isLeaf()).toBe(true);
		expect(blank.octant()).toBe(0);
		expect(blank.z()).toBe(0);
		expect(new OctTreeElement(4).value()).toBe(4);
	});

	it('cleanObj resets every field to a fresh node', () => {
		const tree = new OctTree<Pt>(byPoint, [
			{x: 0, y: 0, z: 0},
			{x: -1, y: -1, z: -1}
		]);
		const root = tree.root() as OctTreeElement<Pt>;
		const child = root.child(7) as OctTreeElement<Pt>;
		expect(child.octant()).toBe(7);
		root.cleanObj();
		child.cleanObj();

		expect(root).toEqual(new OctTreeElement<Pt>());
		expect(child).toEqual(new OctTreeElement<Pt>());
	});

	it('children lists existing children in octant order', () => {
		const tree = new OctTree<Pt>(byPoint, [
			{x: 0, y: 0, z: 0},
			{x: 1, y: 1, z: -1},
			{x: -1, y: 1, z: 1}
		]);
		const root = tree.root()!;

		expect(root.children().map((c) => c.octant())).toEqual([1, 4]);
		expect(root.child(0)).toBeNull();
		expect(root.child(9 as any)).toBeNull();
		expect(root.isLeaf()).toBe(false);
		expect(root.child(4)?.parent()).toBe(root);
	});

	it('only accepts a value at the same position while linked', () => {
		const tree = new OctTree<Pt>(byPoint, [{x: 2, y: 2, z: 2, v: 'a'}]);
		const node = tree.root()!;
		const updated = {x: 2, y: 2, z: 2, v: 'updated'};

		node.value(updated);
		expect(node.value()).toBe(updated);

		node.value({x: 2, y: 2, z: 3, v: 'breaks order'});
		expect(node.value()).toBe(updated);

		const unlinked = new OctTreeElement<Pt>();
		unlinked.value(updated);
		expect(unlinked.value()).toBe(updated);
	});
});
