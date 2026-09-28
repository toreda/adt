import {OctTree} from '../../src/oct/tree';
import {OctTreeElement} from '../../src/oct/tree/element';
import {OctTreeIterator} from '../../src/oct/tree/iterator';
import type {OctTreePoint} from '../../src/oct/tree/point';
import {ObjectPool} from '../../src/object/pool';

interface Pt {
	x: number;
	y: number;
	z: number;
	id?: number;
}

const byPoint = (item: Pt): OctTreePoint => item;
const poolOf = (target: OctTree<any>): ObjectPool<any> | null => (target as any).elements.objectPool;

/** Deterministic pseudo random numbers in [0, 1), so failures reproduce. */
const seeded = (seed: number): (() => number) => {
	let state = seed;

	return (): number => {
		state = (state * 1664525 + 1013904223) % 4294967296;
		return state / 4294967296;
	};
};

const randomPoints = (count: number, seed: number, scale: number = 50): Pt[] => {
	const random = seeded(seed);
	const result: Pt[] = [];

	for (let i = 0; i < count; i++) {
		// Rounded so duplicates and shared coordinates show up.
		result.push({
			x: Math.round(random() * scale),
			y: Math.round(random() * scale),
			z: Math.round(random() * scale),
			id: i
		});
	}

	return result;
};

const octantOf = (node: OctTreeElement<any>, x: number, y: number, z: number): number => {
	return (x < node.x() ? 1 : 0) | (y < node.y() ? 2 : 0) | (z < node.z() ? 4 : 0);
};

/**
 * Walk the whole tree and check every structural rule: parent links agree with
 * child links, each child records the octant it sits in, every node lies in the
 * octant of each ancestor its path passes through, every node is owned by the
 * tree, stored positions match the locator, and size matches the node count.
 */
const expectValid = <T>(tree: OctTree<T>): void => {
	const root = tree.root();
	let count = 0;

	if (root) {
		expect(root.parent()).toBeNull();
	}

	const stack: OctTreeElement<T>[] = root ? [root] : [];

	while (stack.length) {
		const node = stack.pop()!;
		count++;

		expect(node._tree).toBe(tree);
		expect(node._linkId).toBeGreaterThan(0);

		const point = tree.locator(node.value() as T);
		expect(node.x()).toBe(point.x);
		expect(node.y()).toBe(point.y);
		expect(node.z()).toBe(point.z);

		let child: OctTreeElement<T> = node;
		let ancestor = node.parent();

		while (ancestor) {
			expect(ancestor.child(child.octant())).toBe(child);
			expect(octantOf(ancestor, node.x(), node.y(), node.z())).toBe(child.octant());
			child = ancestor;
			ancestor = ancestor.parent();
		}

		expect(node._children.length).toBe(8);
		node._children.forEach((c, octant) => {
			if (c) {
				expect(c.parent()).toBe(node);
				expect(c.octant()).toBe(octant);
				stack.push(c);
			}
		});
	}

	expect(tree.size()).toBe(count);
};

const distance = (a: OctTreePoint, b: OctTreePoint): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const ids = (nodes: OctTreeElement<Pt>[]): number[] => nodes.map((n) => n.value()!.id!).sort((a, b) => a - b);

const tree = new OctTree<Pt>(byPoint);

describe('OctTree', () => {
	beforeEach(() => {
		tree.reset();
		expect(tree.isEmpty()).toBe(true);
	});

	describe('INSTANTIATION', () => {
		it('with only a locator', () => {
			const result = new OctTree<Pt>(byPoint);

			expect(result).toBeInstanceOf(OctTree);
			expect(result.size()).toBe(0);
			expect(result.root()).toBeNull();
			expect(result.locator).toBe(byPoint);
			expect(result.allowDuplicates).toBe(true);
		});

		it('with items placed in every octant', () => {
			const root = {x: 0, y: 0, z: 0};
			const items = [root];

			for (let octant = 0; octant < 8; octant++) {
				items.push({
					x: octant & 1 ? -1 : 1,
					y: octant & 2 ? -1 : 1,
					z: octant & 4 ? -1 : 1
				});
			}

			const result = new OctTree<Pt>(byPoint, items);

			expect(result.size()).toBe(9);
			expect(result.root()?.value()).toBe(root);

			for (let octant = 0; octant < 8; octant++) {
				expect(
					result
						.root()
						?.child(octant as any)
						?.value()
				).toBe(items[octant + 1]);
			}

			expectValid(result);
		});

		it('throws without a locator function', () => {
			expect(() => new OctTree<Pt>(undefined as any)).toThrow();
			expect(() => new OctTree<Pt>(null as any)).toThrow();
			expect(() => new OctTree<Pt>({} as any)).toThrow();
		});

		it('ignores invalid data and options instead of throwing', () => {
			expect(new OctTree(byPoint, 'adsf' as any).size()).toBe(0);
			expect(new OctTree(byPoint, null).size()).toBe(0);
			expect(new OctTree(byPoint, [{x: 1, y: 1, z: 1}], 'nope' as any).size()).toBe(1);
			expect(new OctTree(byPoint, [], {allowDuplicates: 'no' as any}).allowDuplicates).toBe(true);
		});
	});

	describe('ELEMENT POOLING', () => {
		it('is enabled by default and only strict true disables it', () => {
			expect(poolOf(new OctTree(byPoint))).toBeInstanceOf(ObjectPool);
			expect(poolOf(new OctTree(byPoint, [], {disableElementPooling: true}))).toBeNull();
			expect(poolOf(new OctTree(byPoint, [], {disableElementPooling: 'true' as any}))).toBeInstanceOf(
				ObjectPool
			);
		});

		it('recycles a removed node for a later insert', () => {
			const pooled = new OctTree<Pt>(byPoint);
			const first = pooled.insert({x: 1, y: 1, z: 1}) as OctTreeElement<Pt>;
			pooled.removeNode(first);

			const item = {x: 2, y: 3, z: 4};
			const second = pooled.insert(item) as OctTreeElement<Pt>;

			expect(second).toBe(first);
			expect(second.value()).toBe(item);
			expect(second.z()).toBe(4);
			expectValid(pooled);
		});

		it('filter keeps the options', () => {
			const unpooled = new OctTree<Pt>(byPoint, [{x: 1, y: 1, z: 1}], {
				disableElementPooling: true,
				allowDuplicates: false
			});
			const result = unpooled.filter(() => true);

			expect(poolOf(result)).toBeNull();
			expect(result.allowDuplicates).toBe(false);
		});
	});

	describe('insert', () => {
		it('sends positions equal on an axis to the larger side', () => {
			tree.insert({x: 0, y: 0, z: 0});
			const node = tree.insert({x: 0, y: -1, z: 0}) as OctTreeElement<Pt>;

			expect(node.octant()).toBe(2);
		});

		it('returns invalid_position when the locator gives no finite point', () => {
			expect(tree.insert({x: 0, y: 0, z: NaN})).toBe('invalid_position');
			expect(tree.insert({x: 0, y: 0} as any)).toBe('invalid_position');
			expect(tree.insert(null as any)).toBe('invalid_position');
			expect(tree.size()).toBe(0);
		});

		it('handles duplicates per allowDuplicates', () => {
			const first = tree.insert({x: 1, y: 1, z: 1}) as OctTreeElement<Pt>;
			const second = tree.insert({x: 1, y: 1, z: 1}) as OctTreeElement<Pt>;

			expect(second.parent()).toBe(first);
			expect(tree.find({x: 1, y: 1, z: 1})).toBe(first);

			const unique = new OctTree<Pt>(byPoint, [{x: 1, y: 1, z: 1}], {allowDuplicates: false});
			expect(unique.insert({x: 1, y: 1, z: 1})).toBe('duplicate_not_allowed');
			expect(unique.insert({x: 1, y: 1, z: 2})).toBeInstanceOf(OctTreeElement);
		});

		it('keeps the tree valid for many items', () => {
			tree.insertArray(randomPoints(500, 1));

			expect(tree.size()).toBe(500);
			expectValid(tree);
		});
	});

	describe('find, remove, and update', () => {
		it('finds every inserted item and misses other points', () => {
			const points = randomPoints(300, 2);
			tree.insertArray(points);

			for (const point of points) {
				expect(tree.find(point)?.z()).toBe(point.z);
			}

			expect(tree.contains({x: 0.5, y: 0.5, z: 0.5})).toBe(false);
			expect(tree.find({x: 1, y: 1} as any)).toBeNull();
		});

		it('remove matches the item itself', () => {
			const a = {x: 1, y: 1, z: 1, id: 1};
			const b = {x: 1, y: 1, z: 1, id: 2};
			tree.insertArray([a, b]);

			expect(tree.remove({x: 1, y: 1, z: 1, id: 1})).toBeNull();
			expect(tree.remove(b)).toBe(b);
			expect(tree.root()?.value()).toBe(a);
		});

		it('removes every item in random order and stays valid', () => {
			const points = randomPoints(300, 3);
			const nodes = points.map((p) => tree.insert(p) as OctTreeElement<Pt>);
			const random = seeded(4);
			const order = points.slice().sort(() => random() - 0.5);

			for (let i = 0; i < order.length; i++) {
				expect(tree.remove(order[i])).toBe(order[i]);

				if (i % 25 === 0) {
					expectValid(tree);

					// Every remaining handle still holds its own item.
					for (const node of nodes) {
						if (node._tree === tree) {
							expect(tree.locator(node.value()!).x).toBe(node.x());
						}
					}
				}
			}

			expect(tree.size()).toBe(0);
			expect(tree.removeNode(nodes[0])).toBeNull();
		});

		it('update moves an item changed in place and keeps the same node', () => {
			const nodes = randomPoints(100, 5).map((p) => tree.insert(p) as OctTreeElement<Pt>);
			const node = nodes[0];
			const item = node.value()!;
			item.z = -500;

			expect(tree.update(node, item)).toBe(node);
			expect(node.z()).toBe(-500);
			expect(tree.find(item)).toBe(node);
			expect(tree.size()).toBe(100);
			expectValid(tree);
		});

		it('update removes the node on an invalid or duplicate position', () => {
			const node = tree.insert({x: 1, y: 1, z: 1}) as OctTreeElement<Pt>;
			expect(tree.update(node, {x: 1, y: 1, z: NaN})).toBe('invalid_position');
			expect(tree.size()).toBe(0);

			const unique = new OctTree<Pt>(byPoint, [{x: 1, y: 1, z: 1}], {allowDuplicates: false});
			const other = unique.insert({x: 2, y: 2, z: 2}) as OctTreeElement<Pt>;
			expect(unique.update(other, {x: 1, y: 1, z: 1})).toBe('duplicate_not_allowed');
			expect(unique.size()).toBe(1);
			expect(unique.update(null, {x: 1, y: 1, z: 1})).toBeNull();
		});
	});

	describe('spatial searches', () => {
		const points = randomPoints(500, 6);

		beforeEach(() => {
			tree.insertArray(points);
		});

		it('withinBounds matches a brute force scan, faces included', () => {
			const random = seeded(7);
			const pair = (): [number, number] => {
				const a = Math.round(random() * 50);
				const b = Math.round(random() * 50);
				return [Math.min(a, b), Math.max(a, b)];
			};

			for (let i = 0; i < 50; i++) {
				const [minX, maxX] = pair();
				const [minY, maxY] = pair();
				const [minZ, maxZ] = pair();
				const expected = points
					.filter(
						(p) =>
							p.x >= minX &&
							p.x <= maxX &&
							p.y >= minY &&
							p.y <= maxY &&
							p.z >= minZ &&
							p.z <= maxZ
					)
					.map((p) => p.id!)
					.sort((a, b) => a - b);

				expect(ids(tree.withinBounds({minX, minY, minZ, maxX, maxY, maxZ}))).toEqual(expected);
			}
		});

		it('withinBounds returns an empty array for invalid bounds', () => {
			expect(tree.withinBounds(null as any)).toEqual([]);
			expect(tree.withinBounds({minX: 0, minY: 0, minZ: 5, maxX: 1, maxY: 1, maxZ: 1})).toEqual([]);
			expect(tree.withinBounds({minX: 0, minY: 0, maxX: 1, maxY: 1} as any)).toEqual([]);
		});

		it('withinRadius matches a brute force scan, boundary included', () => {
			const random = seeded(8);

			for (let i = 0; i < 50; i++) {
				const center = {
					x: Math.round(random() * 50),
					y: Math.round(random() * 50),
					z: Math.round(random() * 50)
				};
				const radius = Math.round(random() * 15);
				const expected = points
					.filter((p) => distance(p, center) <= radius)
					.map((p) => p.id!)
					.sort((a, b) => a - b);

				expect(ids(tree.withinRadius(center, radius))).toEqual(expected);
			}

			expect(tree.withinRadius({x: 0, y: 0, z: 0}, -1)).toEqual([]);
			expect(tree.withinRadius({x: 0, y: 0} as any, 1)).toEqual([]);
		});

		it('nearest matches a brute force scan', () => {
			const random = seeded(9);

			for (let i = 0; i < 100; i++) {
				const target = {x: random() * 70 - 10, y: random() * 70 - 10, z: random() * 70 - 10};
				const best = Math.min(...points.map((p) => distance(p, target)));

				expect(distance(tree.nearest(target)!.value()!, target)).toBe(best);
			}

			expect(tree.nearest({x: NaN, y: 0, z: 0})).toBeNull();
			expect(new OctTree<Pt>(byPoint).nearest({x: 0, y: 0, z: 0})).toBeNull();
		});
	});

	describe('shape and traversal', () => {
		// Root 0 holds 1 (octant 0) and 2 (octant 7). 1 holds 3 (octant 0).
		const items: Pt[] = [
			{x: 0, y: 0, z: 0, id: 0},
			{x: 1, y: 1, z: 1, id: 1},
			{x: -1, y: -1, z: -1, id: 2},
			{x: 2, y: 2, z: 2, id: 3}
		];
		const idsOf = (values: Pt[]): number[] => values.map((v) => v.id!);

		beforeEach(() => {
			tree.insertArray(items);
		});

		it('height and depth follow the links', () => {
			expect(tree.height()).toBe(2);
			expect(tree.depth(tree.root())).toBe(0);
			expect(tree.depth(tree.find(items[3]))).toBe(2);
			expect(tree.depth(new OctTreeElement<Pt>())).toBeNull();
			expect(new OctTree<Pt>(byPoint).height()).toBe(-1);
		});

		it('walks in pre-order, post-order, and level order', () => {
			expect(idsOf(tree.preOrder())).toEqual([0, 1, 3, 2]);
			expect(idsOf(tree.values())).toEqual([0, 1, 3, 2]);
			expect(idsOf(tree.postOrder())).toEqual([3, 1, 2, 0]);
			expect(idsOf(tree.levelOrder())).toEqual([0, 1, 2, 3]);
			expect(idsOf([...tree] as Pt[])).toEqual([0, 1, 3, 2]);
			expect(tree[Symbol.iterator]()).toBeInstanceOf(OctTreeIterator);
			expect(tree.toArray().map((n) => n.value()!.id)).toEqual([0, 1, 3, 2]);
			expect(tree.preOrderNext(null)).toBeNull();
		});

		it('forEach passes element, index, and tree, and survives removal', () => {
			const seen: number[] = [];

			tree.forEach((elem, idx, t) => {
				expect(t).toBe(tree);
				seen.push(idx);
				tree.removeNode(elem);
			});

			expect(seen).toEqual([0, 1, 2, 3]);
			expect(tree.size()).toBe(0);
		});

		it('filter keeps only matching items', () => {
			const result = tree.filter((elem) => elem.z() >= 0);

			expect(idsOf(result.values())).toEqual([0, 1, 3]);
			expectValid(result);
		});

		it('query finds, limits, and deletes matches', () => {
			const results = tree.query((p) => p.x > 0);

			expect(results.map((r) => r.element.value()!.id)).toEqual([1, 3]);
			expect(tree.query(() => true, {limit: 2}).length).toBe(2);
			expect(results[0].delete()).toBe(items[1]);
			expect(results[0].delete()).toBeNull();
			expect(tree.size()).toBe(3);
			expectValid(tree);
		});

		it('stringify serializes items in pre-order', () => {
			expect(JSON.parse(tree.stringify()!)).toEqual({type: 'OctTree', elements: tree.preOrder()});
		});

		it('clearElements unlinks every node', () => {
			const nodes = tree.toArray();
			tree.clearElements();

			expect(tree.size()).toBe(0);
			expect(nodes.every((n) => n._tree === null && n.isLeaf())).toBe(true);
		});
	});
});
