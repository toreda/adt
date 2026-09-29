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

	describe('HOT PATH', () => {
		/** Internal scratch state must be empty between calls, holding no nodes. */
		const expectScratchClean = (target: OctTree<any>): void => {
			const internal = target as any;

			expect(internal.stackTop).toBe(0);
			expect(internal.stackNodes.every((n: unknown) => n === null)).toBe(true);
			expect(internal.eachTop).toBe(0);
			expect(internal.eachNodes.every((n: unknown) => n === null)).toBe(true);
			expect(internal.slotParent).toBeNull();
		};

		/**
		 * Reference for relinking removal: the tree built by inserting every
		 * item outside node's subtree in pre-order, then node's descendants in
		 * pre-order. This is the shape the old two-array implementation built.
		 */
		const expectedAfterRemoval = (source: OctTree<Pt>, node: OctTreeElement<Pt>): Pt[] => {
			const inside = new Set<OctTreeElement<Pt>>();
			const stack = [node];

			while (stack.length) {
				const curr = stack.pop()!;
				inside.add(curr);
				stack.push(...curr.children());
			}

			const all = source.toArray();
			const outside = all.filter((n) => !inside.has(n)).map((n) => n.value()!);
			const orphans = all.filter((n) => inside.has(n) && n !== node).map((n) => n.value()!);

			return new OctTree<Pt>(byPoint, [...outside, ...orphans]).preOrder();
		};

		const cube = (min: number, max: number) => ({
			minX: min,
			minY: min,
			minZ: min,
			maxX: max,
			maxY: max,
			maxZ: max
		});

		describe('withinBounds with an out array', () => {
			it('fills and returns the given array, replacing its contents', () => {
				tree.insertArray(randomPoints(300, 20));
				const out: OctTreeElement<Pt>[] = [tree.root()!, tree.root()!, tree.root()!];
				const bounds = {minX: 5, minY: 10, minZ: 0, maxX: 30, maxY: 40, maxZ: 25};

				expect(tree.withinBounds(bounds, out)).toBe(out);
				expect(out).toEqual(tree.withinBounds(bounds));
			});

			it('shrinks the array when fewer nodes match, and empties it on invalid bounds', () => {
				tree.insertArray(randomPoints(300, 21));
				const out: OctTreeElement<Pt>[] = [];

				tree.withinBounds(cube(0, 50), out);
				expect(out.length).toBe(300);

				tree.withinBounds(cube(0, 10), out);
				expect(out).toEqual(tree.withinBounds(cube(0, 10)));

				expect(tree.withinBounds(cube(5, 1), out)).toBe(out);
				expect(out.length).toBe(0);
			});

			it('ignores a non-array out and returns a new array', () => {
				tree.insert({x: 1, y: 1, z: 1});

				expect(tree.withinBounds(cube(0, 2), 'nope' as any).length).toBe(1);
				expect(tree.withinBounds(cube(0, 2), null).length).toBe(1);
			});

			it('empties out for an empty tree', () => {
				const out = [new OctTreeElement<Pt>()];

				expect(tree.withinBounds(cube(0, 1), out)).toBe(out);
				expect(out.length).toBe(0);
			});
		});

		describe('withinRadius with an out array', () => {
			it('fills and returns the given array, matching a brute force scan', () => {
				const points = randomPoints(300, 22);
				tree.insertArray(points);
				const out: OctTreeElement<Pt>[] = [];
				const random = seeded(23);

				for (let i = 0; i < 30; i++) {
					const center = {x: random() * 50, y: random() * 50, z: random() * 50};
					const radius = random() * 20;
					const expected = points
						.filter((p) => distance(p, center) <= radius)
						.map((p) => p.id!)
						.sort((a, b) => a - b);

					expect(tree.withinRadius(center, radius, out)).toBe(out);
					expect(ids(out)).toEqual(expected);
				}
			});

			it('empties out on invalid input', () => {
				tree.insertArray(randomPoints(20, 24));
				const out = tree.withinRadius({x: 25, y: 25, z: 25}, 100);
				expect(out.length).toBe(20);

				expect(tree.withinRadius({x: 25, y: 25, z: 25}, -1, out)).toBe(out);
				expect(out.length).toBe(0);
			});
		});

		it('searches leave the scratch stacks empty and do not grow them once warm', () => {
			tree.insertArray(randomPoints(500, 25));
			const internal = tree as any;
			const random = seeded(26);
			const out: OctTreeElement<Pt>[] = [];

			const run = (): void => {
				for (let i = 0; i < 50; i++) {
					const point = {x: random() * 50, y: random() * 50, z: random() * 50};
					tree.nearest(point);
					tree.withinRadius(point, 10, out);
					tree.withinBounds(
						{
							minX: point.x,
							minY: point.y,
							minZ: point.z,
							maxX: point.x + 10,
							maxY: point.y + 10,
							maxZ: point.z + 10
						},
						out
					);
				}
			};

			run();
			expectScratchClean(tree);
			const nodesLength = internal.stackNodes.length;
			const regionsLength = internal.stackRegions.length;

			run();
			expect(internal.stackNodes.length).toBe(nodesLength);
			expect(internal.stackRegions.length).toBe(regionsLength);
			expectScratchClean(tree);
		});

		it('nearest matches a brute force scan across mixed calls', () => {
			const points = randomPoints(300, 27);
			tree.insertArray(points);
			const random = seeded(28);

			for (let i = 0; i < 100; i++) {
				const target = {x: random() * 70 - 10, y: random() * 70 - 10, z: random() * 70 - 10};
				// Interleave another region walk to check stack state is reset.
				tree.withinRadius(target, 10);
				const best = Math.min(...points.map((p) => distance(p, target)));

				expect(distance(tree.nearest(target)!.value()!, target)).toBe(best);
			}
		});

		describe('removal relinking', () => {
			it('removing a leaf moves no other node', () => {
				tree.insertArray(randomPoints(200, 29));
				const nodes = tree.toArray();
				const leaf = nodes.find((n) => n.isLeaf() && n.parent() !== null)!;
				const parents = nodes.map((n) => n.parent());

				expect(tree.removeNode(leaf)).not.toBeNull();

				nodes.forEach((n, i) => {
					if (n !== leaf) {
						expect(n.parent()).toBe(parents[i]);
					}
				});
				expectValid(tree);
				expectScratchClean(tree);
			});

			it('removing an inner node relinks its subtree in pre-order', () => {
				const points = randomPoints(300, 30);
				const random = seeded(31);

				for (let round = 0; round < 20; round++) {
					tree.reset();
					tree.insertArray(points);
					const inner = tree.toArray().filter((n) => !n.isLeaf());
					const node = inner[Math.floor(random() * inner.length)];
					const expected = expectedAfterRemoval(tree, node);

					tree.removeNode(node);

					expect(tree.preOrder()).toEqual(expected);
					expectValid(tree);
					expectScratchClean(tree);
				}
			});

			it('moving a leaf with update relinks nothing else', () => {
				tree.insertArray(randomPoints(200, 32));
				const nodes = tree.toArray();
				const leaf = nodes.find((n) => n.isLeaf() && n.parent() !== null)!;
				const others = nodes.filter((n) => n !== leaf);
				const parents = others.map((n) => n.parent());
				const item = leaf.value()!;
				item.x = 250;
				item.y = 250;
				item.z = 250;

				expect(tree.update(leaf, item)).toBe(leaf);

				others.forEach((n, i) => expect(n.parent()).toBe(parents[i]));
				expect(tree.find({x: 250, y: 250, z: 250})).toBe(leaf);
				expectValid(tree);
			});

			it('moving an inner node with update keeps every handle valid', () => {
				const points = randomPoints(200, 33);
				const nodes = points.map((p) => tree.insert(p) as OctTreeElement<Pt>);
				const random = seeded(34);

				for (let i = 0; i < 200; i++) {
					const node = nodes[Math.floor(random() * nodes.length)];
					const item = node.value()!;
					item.x = Math.round(random() * 50);
					item.y = Math.round(random() * 50);
					item.z = Math.round(random() * 50);

					expect(tree.update(node, item)).toBe(node);
				}

				expect(tree.size()).toBe(200);
				expectValid(tree);
				expectScratchClean(tree);
			});
		});

		describe('duplicate check folded into the descent', () => {
			const deepestOf = (target: OctTree<Pt>): OctTreeElement<Pt> =>
				target.toArray().reduce((a, b) => (target.depth(b)! > target.depth(a)! ? b : a));

			it('rejects a duplicate of a node deep in the tree', () => {
				const unique = new OctTree<Pt>(byPoint, [], {allowDuplicates: false});
				unique.insertArray(randomPoints(300, 35));
				const deepest = deepestOf(unique);
				const size = unique.size();

				expect(unique.insert({x: deepest.x(), y: deepest.y(), z: deepest.z()})).toBe(
					'duplicate_not_allowed'
				);
				expect(unique.size()).toBe(size);
				expectValid(unique);
				expectScratchClean(unique);
			});

			it('update to an occupied position deep in the tree removes the node', () => {
				const unique = new OctTree<Pt>(byPoint, [], {allowDuplicates: false});
				unique.insertArray(randomPoints(300, 36));
				const deepest = deepestOf(unique);
				const mover = unique.root()!;
				const item = mover.value()!;
				item.x = deepest.x();
				item.y = deepest.y();
				item.z = deepest.z();
				const size = unique.size();

				expect(unique.update(mover, item)).toBe('duplicate_not_allowed');
				expect(unique.size()).toBe(size - 1);
				expect(mover._tree).toBeNull();
				expect(unique.find(item)).toBe(deepest);
				expectValid(unique);
			});

			it('insert with duplicates rejected keeps every unique position', () => {
				const unique = new OctTree<Pt>(byPoint, [], {allowDuplicates: false});
				const points = randomPoints(500, 37, 6);
				unique.insertArray(points);
				const positions = new Set(points.map((p) => `${p.x},${p.y},${p.z}`));

				expect(unique.size()).toBe(positions.size);
				expectValid(unique);
			});
		});

		describe('forEach', () => {
			it('reuses its scratch arrays and leaves them empty', () => {
				tree.insertArray(randomPoints(300, 38));
				const internal = tree as any;
				let count = 0;

				tree.forEach(() => count++);
				const length = internal.eachNodes.length;
				tree.forEach(() => count++);

				expect(count).toBe(600);
				expect(internal.eachNodes.length).toBe(length);
				expectScratchClean(tree);
			});

			it('supports a nested forEach from func', () => {
				tree.insertArray(randomPoints(20, 39));
				const pairs: string[] = [];

				tree.forEach((outer, i) => {
					tree.forEach((inner, j) => {
						pairs.push(`${i}:${j}`);
						expect(inner._tree).toBe(tree);
					});
					expect(outer._tree).toBe(tree);
				});

				expect(new Set(pairs).size).toBe(400);
				expectScratchClean(tree);
			});

			it('resets its scratch state when func throws', () => {
				tree.insertArray(randomPoints(20, 40));

				expect(() =>
					tree.forEach((_elem, idx) => {
						if (idx === 5) {
							throw new Error('stop');
						}
					})
				).toThrow('stop');
				expectScratchClean(tree);

				let count = 0;
				tree.forEach(() => count++);
				expect(count).toBe(20);
			});

			it('visits moved elements once and skips removed ones', () => {
				tree.insertArray(randomPoints(100, 41));
				const nodes = tree.toArray();
				const seen = new Set<OctTreeElement<Pt>>();
				let visits = 0;

				tree.forEach((elem, idx) => {
					visits++;
					seen.add(elem);
					const item = elem.value()!;
					item.x = 50 - item.x;
					tree.update(elem, item);

					const later = nodes[nodes.length - 1 - idx];
					if (idx < 25 && later._tree === tree) {
						tree.removeNode(later);
					}
				});

				expect(visits).toBe(75);
				expect(seen.size).toBe(75);
				expect(tree.size()).toBe(75);
				expectValid(tree);
			});
		});

		describe('iterator', () => {
			it('reuses one result object', () => {
				tree.insertArray(randomPoints(5, 42));
				const iterator = tree[Symbol.iterator]();
				const first = iterator.next();

				expect(iterator.next()).toBe(first);
				expect(first.done).toBe(false);
			});

			it('yields every item then done, repeatedly', () => {
				tree.insertArray(randomPoints(50, 43));
				const iterator = tree[Symbol.iterator]();
				const values: Pt[] = [];

				for (let r = iterator.next(); !r.done; r = iterator.next()) {
					values.push(r.value!);
				}

				expect(values).toEqual(tree.preOrder());
				expect(iterator.next().done).toBe(true);
				expect(iterator.next().value).toBeNull();
			});

			it('ends instead of yielding a removed node with pooling on', () => {
				tree.insertArray([
					{x: 0, y: 0, z: 0, id: 0},
					{x: 1, y: 1, z: 1, id: 1},
					{x: 2, y: 2, z: 2, id: 2}
				]);
				const seen: Array<Pt | null> = [];

				for (const item of tree) {
					seen.push(item);

					if (item!.id === 0) {
						tree.removeNode(tree.find({x: 1, y: 1, z: 1}));
					}
				}

				expect(seen.map((v) => v?.id)).toEqual([0]);
			});

			it('ends instead of yielding a removed item with pooling off', () => {
				const unpooled = new OctTree<Pt>(byPoint, [], {disableElementPooling: true});
				const removed = {x: 1, y: 1, z: 1, id: 1};
				unpooled.insertArray([{x: 0, y: 0, z: 0, id: 0}, removed, {x: 2, y: 2, z: 2, id: 2}]);
				const seen: Array<Pt | null> = [];

				for (const item of unpooled) {
					seen.push(item);

					if (item!.id === 0) {
						unpooled.remove(removed);
					}
				}

				expect(seen).not.toContain(removed);
				expect(seen).not.toContain(null);
			});

			it('ends when the node due next was recycled for another item', () => {
				tree.insertArray([
					{x: 0, y: 0, z: 0, id: 0},
					{x: 1, y: 1, z: 1, id: 1}
				]);
				const iterator = tree[Symbol.iterator]();
				iterator.next();

				const due = tree.find({x: 1, y: 1, z: 1})!;
				tree.removeNode(due);
				expect(tree.insert({x: 5, y: 5, z: 5, id: 9})).toBe(due);

				expect(iterator.next().done).toBe(true);
			});
		});

		describe('height', () => {
			it('matches a depth scan', () => {
				const random = seeded(44);

				for (let round = 0; round < 10; round++) {
					tree.reset();
					tree.insertArray(randomPoints(Math.floor(random() * 300) + 1, round + 100));
					const expected = Math.max(...tree.toArray().map((n) => tree.depth(n)!));

					expect(tree.height()).toBe(expected);
				}
			});

			it('handles a chain', () => {
				for (let i = 0; i < 50; i++) {
					tree.insert({x: i, y: i, z: i});
				}

				expect(tree.height()).toBe(49);
			});
		});

		it('postOrder and levelOrder keep the scratch stack clean', () => {
			tree.insertArray(randomPoints(100, 45));

			expect(tree.postOrder().length).toBe(100);
			expectScratchClean(tree);
			expect(tree.levelOrder().length).toBe(100);
			expectScratchClean(tree);
			expect(tree.values()).toEqual(tree.toArray().map((n) => n.value()));
		});

		describe('clearElements', () => {
			it('releases every node back to the pool', () => {
				const pooled = new OctTree<Pt>(byPoint, randomPoints(200, 18));
				const nodes = pooled.toArray();
				expect(poolOf(pooled)!.size()).toBe(200);

				pooled.clearElements();

				expect(poolOf(pooled)!.size()).toBe(0);
				expect(nodes.every((n) => n._tree === null && n.value() === null && n.isLeaf())).toBe(true);
				expect(pooled.insert({x: 1, y: 1, z: 1})).toBeInstanceOf(OctTreeElement);
				expectValid(pooled);
			});

			it('unlinks every node when pooling is off', () => {
				const unpooled = new OctTree<Pt>(byPoint, randomPoints(200, 19), {
					disableElementPooling: true
				});
				const nodes = unpooled.toArray();
				unpooled.clearElements();

				expect(unpooled.root()).toBeNull();
				expect(
					nodes.every(
						(n) => n._tree === null && n._linkId === 0 && n.parent() === null && n.isLeaf()
					)
				).toBe(true);
			});
		});

		describe('query', () => {
			it('shares key and index functions across results', () => {
				tree.insertArray(randomPoints(10, 46));
				const [a, b] = tree.query(() => true);

				expect(a.key).toBe(b.key);
				expect(a.index).toBe(b.index);
			});

			it('rounds limit and ignores invalid ones', () => {
				tree.insertArray(randomPoints(10, 47));

				expect(tree.query(() => true, {limit: 2.4}).length).toBe(2);
				expect(tree.query(() => true, {limit: 0}).length).toBe(10);
				expect(tree.query(() => true, {limit: NaN}).length).toBe(10);
			});

			it('stops at the first failing filter', () => {
				tree.insertArray(randomPoints(10, 48));
				const second = jest.fn(() => true);

				expect(tree.query([() => false, second])).toEqual([]);
				expect(second).not.toHaveBeenCalled();
			});
		});

		it('children fills an out array', () => {
			tree.insertArray([
				{x: 0, y: 0, z: 0},
				{x: 1, y: 1, z: 1},
				{x: -1, y: -1, z: -1}
			]);
			const root = tree.root()!;
			const out: OctTreeElement<Pt>[] = [root, root, root, root];

			expect(root.children(out)).toBe(out);
			expect(out).toEqual([root.child(0), root.child(7)]);
			expect(root.child(0)!.children(out)).toEqual([]);
			expect(root.children()).toEqual([root.child(0), root.child(7)]);
		});

		describe('forEachWithinBounds and forEachWithinRadius', () => {
			type El = OctTreeElement<Pt>;

			const visitBounds = (target: OctTree<Pt>, bounds: any): El[] => {
				const seen: El[] = [];
				target.forEachWithinBounds(bounds, (element) => {
					seen.push(element);
				});
				return seen;
			};

			const visitRadius = (target: OctTree<Pt>, point: any, radius: any): El[] => {
				const seen: El[] = [];
				target.forEachWithinRadius(point, radius, (element) => {
					seen.push(element);
				});
				return seen;
			};

			const randomBounds = (random: () => number): any => {
				const x1 = Math.round(random() * 100);
				const x2 = Math.round(random() * 100);
				const y1 = Math.round(random() * 100);
				const z1 = Math.round(random() * 100);
				const z2 = Math.round(random() * 100);
				const y2 = Math.round(random() * 100);
				return {
					minX: Math.min(x1, x2),
					minY: Math.min(y1, y2),
					minZ: Math.min(z1, z2),
					maxX: Math.max(x1, x2),
					maxY: Math.max(y1, y2),
					maxZ: Math.max(z1, z2)
				};
			};

			it('visit the same nodes in the same order as the array methods, on random data', () => {
				tree.insertArray(randomPoints(400, 60, 100));
				const random = seeded(61);

				for (let i = 0; i < 40; i++) {
					const bounds = randomBounds(random);
					const expected = tree.withinBounds(bounds);
					const indexes: number[] = [];
					const seen: El[] = [];

					const returned = tree.forEachWithinBounds(bounds, (element, index, owner) => {
						expect(owner).toBe(tree);
						seen.push(element);
						indexes.push(index);
					});

					expect(returned).toBe(tree);
					expect(seen).toEqual(expected);
					expect(indexes).toEqual(expected.map((_, idx) => idx));

					const center = {x: random() * 120 - 10, y: random() * 120 - 10, z: random() * 120 - 10};
					const radius = random() * 35;
					const expectedRadius = tree.withinRadius(center, radius);
					const radiusIndexes: number[] = [];
					const seenRadius: El[] = [];

					const returnedRadius = tree.forEachWithinRadius(
						center,
						radius,
						(element, index, owner) => {
							expect(owner).toBe(tree);
							seenRadius.push(element);
							radiusIndexes.push(index);
						}
					);

					expect(returnedRadius).toBe(tree);
					expect(seenRadius).toEqual(expectedRadius);
					expect(radiusIndexes).toEqual(expectedRadius.map((_, idx) => idx));
				}

				expectScratchClean(tree);
			});

			it('match a brute force scan', () => {
				const points = randomPoints(300, 62, 100);
				tree.insertArray(points);
				const center = {x: 40, y: 55, z: 40};
				const byId = (nodes: El[]): number[] => ids(nodes);

				expect(byId(visitRadius(tree, center, 20))).toEqual(
					points.filter((p) => distance(p, center) <= 20).map((p) => p.id!)
				);
				expect(
					byId(visitBounds(tree, {minX: 10, minY: 20, minZ: 10, maxX: 50, maxY: 70, maxZ: 50}))
				).toEqual(
					points
						.filter(
							(p) => p.x >= 10 && p.x <= 50 && p.y >= 20 && p.y <= 70 && p.z >= 10 && p.z <= 50
						)
						.map((p) => p.id!)
				);
			});

			it('call func with thisArg as this, and undefined when omitted', () => {
				tree.insertArray(randomPoints(20, 63, 100));
				const context = {name: 'ctx'};
				const bounds = {minX: 0, minY: 0, minZ: 0, maxX: 100, maxY: 100, maxZ: 100};
				const thisValues: unknown[] = [];
				const record = function (this: unknown): void {
					thisValues.push(this);
				};

				tree.forEachWithinBounds(bounds, record, context);
				tree.forEachWithinRadius({x: 50, y: 50, z: 50}, 200, record, context);
				expect(thisValues.length).toBe(40);
				expect(thisValues.every((value) => value === context)).toBe(true);

				thisValues.length = 0;
				tree.forEachWithinBounds(bounds, record);
				tree.forEachWithinRadius({x: 50, y: 50, z: 50}, 200, record);
				expect(thisValues.length).toBe(40);
				expect(thisValues.every((value) => value === undefined)).toBe(true);
			});

			it('visit nothing on invalid bounds, point, or radius', () => {
				tree.insertArray(randomPoints(50, 64, 100));
				const func = jest.fn();
				const badBounds = [
					null,
					undefined,
					'bounds',
					{},
					{minX: 0, minY: 0, minZ: 0, maxX: 10, maxY: 10},
					{minX: 0, minY: 0, minZ: 20, maxX: 10, maxY: 10, maxZ: 10},
					{minX: NaN, minY: 0, minZ: NaN, maxX: 10, maxY: 10, maxZ: 10},
					{minX: 0, minY: 0, minZ: 0, maxX: Infinity, maxY: 10, maxZ: Infinity},
					{minX: 20, minY: 0, minZ: 20, maxX: 10, maxY: 10, maxZ: 10},
					{minX: 0, minY: 20, minZ: 0, maxX: 10, maxY: 10, maxZ: 10},
					{minX: '0', minY: 0, minZ: '0', maxX: 10, maxY: 10, maxZ: 10}
				];
				const badPoints = [
					null,
					undefined,
					5,
					{x: 1, y: 1},
					{x: NaN, y: 1, z: 1},
					{x: 1, y: 1, z: NaN},
					{x: 1, y: -Infinity, z: 1},
					{x: '1', y: 1, z: '1'}
				];
				const badRadii = [-1, NaN, Infinity, -Infinity, '5', null, undefined];

				for (const bounds of badBounds) {
					expect(tree.forEachWithinBounds(bounds as any, func)).toBe(tree);
				}

				for (const point of badPoints) {
					expect(tree.forEachWithinRadius(point as any, 10, func)).toBe(tree);
				}

				for (const radius of badRadii) {
					expect(tree.forEachWithinRadius({x: 50, y: 50, z: 50}, radius as any, func)).toBe(tree);
				}

				expect(func).not.toHaveBeenCalled();
				expectScratchClean(tree);
			});

			it('visit nothing on an empty tree', () => {
				const func = jest.fn();

				expect(
					tree.forEachWithinBounds(
						{minX: -1e9, minY: -1e9, minZ: -1e9, maxX: 1e9, maxY: 1e9, maxZ: 1e9},
						func
					)
				).toBe(tree);
				expect(tree.forEachWithinRadius({x: 0, y: 0, z: 0}, 1e9, func)).toBe(tree);
				expect(func).not.toHaveBeenCalled();
				expectScratchClean(tree);
			});

			it('radius 0 visits only nodes exactly at point', () => {
				tree.insertArray([
					{x: 5, y: 5, z: 5, id: 0},
					{x: 5, y: 5, z: 5, id: 1},
					{x: 5, y: 6, z: 5, id: 2}
				]);

				expect(ids(visitRadius(tree, {x: 5, y: 5, z: 5}, 0))).toEqual([0, 1]);
			});

			describe('mutation from func', () => {
				for (const pooling of [true, false]) {
					const label = pooling ? 'pooling on' : 'pooling off';
					const make = (): OctTree<Pt> =>
						new OctTree<Pt>(byPoint, randomPoints(300, 65, 100), {
							disableElementPooling: !pooling
						});
					const bounds = {minX: 20, minY: 20, minZ: 20, maxX: 70, maxY: 70, maxZ: 70};
					const center = {x: 45, y: 45, z: 45};

					it(`func may remove each visited match (${label})`, () => {
						const target = make();
						const expected = target.withinBounds(bounds).map((n) => n.value()!);
						const seen: Pt[] = [];

						target.forEachWithinBounds(bounds, (element, index, owner) => {
							seen.push(element.value()!);
							expect(owner.removeNode(element)).toBe(seen[index]);
						});

						expect(seen).toEqual(expected);
						expect(target.size()).toBe(300 - expected.length);
						expect(target.withinBounds(bounds)).toEqual([]);
						expectValid(target);
						expectScratchClean(target);
					});

					it(`skips matches removed before they are reached (${label})`, () => {
						const target = make();
						const expected = target.withinRadius(center, 20);
						expect(expected.length).toBeGreaterThan(4);
						const victim = expected[expected.length - 1];
						const victimItem = victim.value()!;
						const seen: Pt[] = [];

						target.forEachWithinRadius(center, 20, (element, index) => {
							seen.push(element.value()!);

							if (index === 0) {
								target.removeNode(victim);
								// With pooling on this recycles the victim's node for
								// a new item inside the radius; it must not be visited.
								target.insert({x: center.x, y: center.y, z: center.z, id: -1});
							}
						});

						expect(seen).toEqual(expected.slice(0, -1).map((n) => n.value()!));
						expect(seen).not.toContain(victimItem);
						expect(seen.some((p) => p.id === -1)).toBe(false);
						expectValid(target);
						expectScratchClean(target);
					});

					it(`visits moved matches once and never visits inserted items (${label})`, () => {
						const target = make();
						const expected = target.withinBounds(bounds).map((n) => n.value()!);
						const seen: Pt[] = [];

						target.forEachWithinBounds(bounds, (element) => {
							const item = element.value()!;
							seen.push(item);
							// Move every match out of bounds, and add a new match.
							item.x += 200;
							target.update(element, item);
							target.insert({x: 50, y: 50, z: 50, id: -1});
						});

						expect(seen).toEqual(expected);
						expect(target.size()).toBe(300 + expected.length);
						expect(target.withinBounds(bounds).every((n) => n.value()!.id === -1)).toBe(true);
						expectValid(target);
						expectScratchClean(target);
					});

					it(`stops visiting once func clears the tree (${label})`, () => {
						const target = make();
						const func = jest.fn(() => {
							target.clearElements();
						});

						target.forEachWithinRadius(center, 30, func);

						expect(func).toHaveBeenCalledTimes(1);
						expect(target.size()).toBe(0);
						expectScratchClean(target);
					});
				}
			});

			describe('scratch state', () => {
				it('nested visitors and queries from func see correct results', () => {
					tree.insertArray(randomPoints(300, 66, 100));
					const outer = {minX: 30, minY: 30, minZ: 30, maxX: 40, maxY: 40, maxZ: 40};
					const inner = {minX: 0, minY: 0, minZ: 0, maxX: 60, maxY: 60, maxZ: 60};
					const expectedInner = tree.withinBounds(inner);
					const expectedOuter = tree.withinBounds(outer);
					const expectedRadius = tree.withinRadius({x: 10, y: 80, z: 10}, 15);
					const seen: El[] = [];

					tree.forEachWithinBounds(outer, (element) => {
						seen.push(element);
						expect(visitBounds(tree, inner)).toEqual(expectedInner);
						expect(visitRadius(tree, {x: 10, y: 80, z: 10}, 15)).toEqual(expectedRadius);
						expect(tree.withinBounds(inner)).toEqual(expectedInner);
						expect(tree.withinRadius({x: 10, y: 80, z: 10}, 15)).toEqual(expectedRadius);
						const near = tree.nearest({x: element.x(), y: element.y(), z: element.z()})!;
						expect([near.x(), near.y(), near.z()]).toEqual([
							element.x(),
							element.y(),
							element.z()
						]);

						let count = 0;
						tree.forEach(() => {
							count++;
						});
						expect(count).toBe(300);
					});

					expect(seen).toEqual(expectedOuter);
					expectScratchClean(tree);
				});

				it('sequential calls of different sizes do not see earlier matches', () => {
					tree.insertArray(randomPoints(300, 67, 100));
					const big = {minX: 0, minY: 0, minZ: 0, maxX: 100, maxY: 100, maxZ: 100};
					const small = {minX: 0, minY: 0, minZ: 0, maxX: 15, maxY: 15, maxZ: 15};

					expect(visitBounds(tree, big)).toEqual(tree.withinBounds(big));
					expect(visitBounds(tree, small)).toEqual(tree.withinBounds(small));
					expect(visitRadius(tree, {x: 50, y: 50, z: 50}, 100)).toEqual(
						tree.withinRadius({x: 50, y: 50, z: 50}, 100)
					);
					expect(visitRadius(tree, {x: 90, y: 5, z: 90}, 5)).toEqual(
						tree.withinRadius({x: 90, y: 5, z: 90}, 5)
					);
					expect(visitBounds(tree, {minX: 5, minY: 0, minZ: 5, maxX: 1, maxY: 1, maxZ: 1})).toEqual(
						[]
					);
					expectScratchClean(tree);
				});

				it('releases the snapshot when func throws', () => {
					tree.insertArray(randomPoints(100, 68, 100));
					const bounds = {minX: 0, minY: 0, minZ: 0, maxX: 100, maxY: 100, maxZ: 100};
					const error = new Error('stop');

					expect(() =>
						tree.forEachWithinBounds(bounds, () => {
							throw error;
						})
					).toThrow(error);
					expectScratchClean(tree);

					expect(() =>
						tree.forEachWithinRadius({x: 50, y: 50, z: 50}, 30, () => {
							throw error;
						})
					).toThrow(error);
					expectScratchClean(tree);

					expect(visitBounds(tree, bounds)).toEqual(tree.withinBounds(bounds));
				});

				it('do not grow the scratch arrays once warm', () => {
					tree.insertArray(randomPoints(500, 69, 100));
					const internal = tree as any;
					const random = seeded(70);
					const func = (): void => {};

					tree.forEachWithinBounds(
						{minX: 0, minY: 0, minZ: 0, maxX: 100, maxY: 100, maxZ: 100},
						func
					);
					tree.forEachWithinRadius({x: 50, y: 50, z: 50}, 200, func);
					const eachLength = internal.eachNodes.length;
					const idsLength = internal.eachLinkIds.length;
					const stackLength = internal.stackNodes.length;
					const regionsLength = internal.stackRegions.length;

					for (let i = 0; i < 50; i++) {
						tree.forEachWithinBounds(randomBounds(random), func);
						tree.forEachWithinRadius(
							{x: random() * 100, y: random() * 100, z: random() * 100},
							random() * 40,
							func
						);
					}

					expect(internal.eachNodes.length).toBe(eachLength);
					expect(internal.eachLinkIds.length).toBe(idsLength);
					expect(internal.stackNodes.length).toBe(stackLength);
					expect(internal.stackRegions.length).toBe(regionsLength);
					expectScratchClean(tree);
				});
			});
		});
	});
});
