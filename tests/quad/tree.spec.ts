import {QuadTree} from '../../src/quad/tree';
import {QuadTreeElement} from '../../src/quad/tree/element';
import {QuadTreeIterator} from '../../src/quad/tree/iterator';
import type {QuadTreePoint} from '../../src/quad/tree/point';
import {ObjectPool} from '../../src/object/pool';

interface Pt {
	x: number;
	y: number;
	id?: number;
}

const byPoint = (item: Pt): QuadTreePoint => item;
const poolOf = (target: QuadTree<any>): ObjectPool<any> | null => (target as any).elements.objectPool;

/** Deterministic pseudo random numbers in [0, 1), so failures reproduce. */
const seeded = (seed: number): (() => number) => {
	let state = seed;

	return (): number => {
		state = (state * 1664525 + 1013904223) % 4294967296;
		return state / 4294967296;
	};
};

const randomPoints = (count: number, seed: number, scale: number = 100): Pt[] => {
	const random = seeded(seed);
	const result: Pt[] = [];

	for (let i = 0; i < count; i++) {
		// Rounded so duplicates and shared coordinates show up.
		result.push({x: Math.round(random() * scale), y: Math.round(random() * scale), id: i});
	}

	return result;
};

const quadrantOf = (node: QuadTreeElement<any>, x: number, y: number): number => {
	return (x < node.x() ? 1 : 0) | (y < node.y() ? 2 : 0);
};

/**
 * Walk the whole tree and check every structural rule: parent links agree with
 * child links, each child records the quadrant it sits in, every node lies in
 * the quadrant of each ancestor its path passes through, every node is owned
 * by the tree, stored positions match the locator, and size matches the node
 * count.
 */
const expectValid = <T>(tree: QuadTree<T>): void => {
	const root = tree.root();
	let count = 0;

	if (root) {
		expect(root.parent()).toBeNull();
	}

	const stack: QuadTreeElement<T>[] = root ? [root] : [];

	while (stack.length) {
		const node = stack.pop()!;
		count++;

		expect(node._tree).toBe(tree);
		expect(node._linkId).toBeGreaterThan(0);

		const point = tree.locator(node.value() as T);
		expect(node.x()).toBe(point.x);
		expect(node.y()).toBe(point.y);

		let child: QuadTreeElement<T> = node;
		let ancestor = node.parent();

		while (ancestor) {
			const expected = ancestor.child(child.quadrant());
			expect(expected).toBe(child);
			expect(quadrantOf(ancestor, node.x(), node.y())).toBe(child.quadrant());
			child = ancestor;
			ancestor = ancestor.parent();
		}

		expect(node._children.length).toBe(4);
		node._children.forEach((c, quadrant) => {
			if (c) {
				expect(c.parent()).toBe(node);
				expect(c.quadrant()).toBe(quadrant);
				stack.push(c);
			}
		});
	}

	expect(tree.size()).toBe(count);
};

const distance = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y);
const ids = (nodes: QuadTreeElement<Pt>[]): number[] =>
	nodes.map((n) => n.value()!.id!).sort((a, b) => a - b);

const tree = new QuadTree<Pt>(byPoint);

describe('QuadTree', () => {
	beforeEach(() => {
		tree.reset();
		expect(tree.isEmpty()).toBe(true);
	});

	describe('INSTANTIATION', () => {
		it('with only a locator', () => {
			const result = new QuadTree<Pt>(byPoint);

			expect(result).toBeInstanceOf(QuadTree);
			expect(result.size()).toBe(0);
			expect(result.root()).toBeNull();
			expect(result.locator).toBe(byPoint);
			expect(result.allowDuplicates).toBe(true);
		});

		it('with items inserted in array order', () => {
			const a = {x: 0, y: 0};
			const b = {x: 5, y: 5};
			const c = {x: -5, y: 5};
			const d = {x: 5, y: -5};
			const e = {x: -5, y: -5};
			const result = new QuadTree<Pt>(byPoint, [a, b, c, d, e]);

			expect(result.size()).toBe(5);
			expect(result.root()?.value()).toBe(a);
			expect(result.root()?.child(0)?.value()).toBe(b);
			expect(result.root()?.child(1)?.value()).toBe(c);
			expect(result.root()?.child(2)?.value()).toBe(d);
			expect(result.root()?.child(3)?.value()).toBe(e);
			expectValid(result);
		});

		it('does not keep a reference to the provided array', () => {
			const items = [{x: 1, y: 1}];
			const result = new QuadTree<Pt>(byPoint, items);
			items.push({x: 2, y: 2});

			expect(result.size()).toBe(1);
		});

		it('throws without a locator function', () => {
			expect(() => new QuadTree<Pt>(undefined as any)).toThrow();
			expect(() => new QuadTree<Pt>(null as any)).toThrow();
			expect(() => new QuadTree<Pt>({} as any)).toThrow();
		});

		it('ignores invalid data and options instead of throwing', () => {
			expect(new QuadTree(byPoint, 'adsf' as any).size()).toBe(0);
			expect(new QuadTree(byPoint, null).size()).toBe(0);
			expect(new QuadTree(byPoint, {elements: [{x: 1, y: 1}]} as any).size()).toBe(0);
			expect(new QuadTree(byPoint, [{x: 1, y: 1}], null).size()).toBe(1);
			expect(new QuadTree(byPoint, [{x: 1, y: 1}], 'nope' as any).size()).toBe(1);
			expect(new QuadTree(byPoint, [], {allowDuplicates: 'no' as any}).allowDuplicates).toBe(true);
		});

		it('skips items without a valid position', () => {
			const result = new QuadTree<Pt>(byPoint, [
				{x: 1, y: 1},
				{x: NaN, y: 1},
				{x: 2, y: Infinity},
				null as any
			]);

			expect(result.size()).toBe(1);
		});
	});

	describe('ELEMENT POOLING', () => {
		it('is enabled by default', () => {
			expect(poolOf(new QuadTree(byPoint))).toBeInstanceOf(ObjectPool);
		});

		it('only strict true disables it', () => {
			expect(poolOf(new QuadTree(byPoint, [], {disableElementPooling: true}))).toBeNull();
			expect(poolOf(new QuadTree(byPoint, [], {disableElementPooling: 'true' as any}))).toBeInstanceOf(
				ObjectPool
			);
		});

		it('recycles a removed node for a later insert', () => {
			const pooled = new QuadTree<Pt>(byPoint);
			const first = pooled.insert({x: 1, y: 1}) as QuadTreeElement<Pt>;
			pooled.removeNode(first);

			const item = {x: 2, y: 3};
			const second = pooled.insert(item) as QuadTreeElement<Pt>;

			expect(second).toBe(first);
			expect(second.value()).toBe(item);
			expect(second.x()).toBe(2);
			expect(second.y()).toBe(3);
			expectValid(pooled);
		});

		it('does not recycle when disabled', () => {
			const unpooled = new QuadTree<Pt>(byPoint, [], {disableElementPooling: true});
			const first = unpooled.insert({x: 1, y: 1}) as QuadTreeElement<Pt>;
			unpooled.removeNode(first);

			expect(unpooled.insert({x: 2, y: 2})).not.toBe(first);
			expect(first._tree).toBeNull();
			expect(first.parent()).toBeNull();
		});

		it('filter keeps the pooling options', () => {
			const unpooled = new QuadTree<Pt>(byPoint, [{x: 1, y: 1}], {
				disableElementPooling: true,
				allowDuplicates: false
			});
			const result = unpooled.filter(() => true);

			expect(poolOf(result)).toBeNull();
			expect(result.allowDuplicates).toBe(false);
		});
	});

	describe('insert', () => {
		it('places the first item at the root', () => {
			const item = {x: 3, y: 4};
			const node = tree.insert(item) as QuadTreeElement<Pt>;

			expect(tree.root()).toBe(node);
			expect(node.value()).toBe(item);
			expect(node.parent()).toBeNull();
			expect(tree.size()).toBe(1);
		});

		it('sends positions equal on an axis to the east or north side', () => {
			tree.insert({x: 0, y: 0});
			const east = tree.insert({x: 0, y: -1}) as QuadTreeElement<Pt>;
			const north = tree.insert({x: -1, y: 0}) as QuadTreeElement<Pt>;

			expect(east.quadrant()).toBe(2);
			expect(north.quadrant()).toBe(1);
		});

		it('returns invalid_position when the locator gives no finite point', () => {
			expect(tree.insert({x: NaN, y: 0})).toBe('invalid_position');
			expect(tree.insert({x: 0, y: -Infinity})).toBe('invalid_position');
			expect(tree.insert({x: '1', y: 0} as any)).toBe('invalid_position');
			expect(tree.insert(null as any)).toBe('invalid_position');
			expect(tree.size()).toBe(0);
		});

		it('places duplicates below existing ones by default', () => {
			const first = tree.insert({x: 1, y: 1, id: 1}) as QuadTreeElement<Pt>;
			const second = tree.insert({x: 1, y: 1, id: 2}) as QuadTreeElement<Pt>;

			expect(second.parent()).toBe(first);
			expect(second.quadrant()).toBe(0);
			expect(tree.size()).toBe(2);
			expect(tree.find({x: 1, y: 1})).toBe(first);
		});

		it('rejects duplicates when not allowed', () => {
			const unique = new QuadTree<Pt>(byPoint, [], {allowDuplicates: false});
			unique.insert({x: 1, y: 1});

			expect(unique.insert({x: 1, y: 1})).toBe('duplicate_not_allowed');
			expect(unique.insert({x: 1, y: 2})).toBeInstanceOf(QuadTreeElement);
			expect(unique.size()).toBe(2);
		});

		it('keeps the tree valid for many items', () => {
			tree.insertArray(randomPoints(500, 1));

			expect(tree.size()).toBe(500);
			expectValid(tree);
		});
	});

	describe('insertArray', () => {
		it('ignores non-arrays', () => {
			tree.insertArray(null);
			tree.insertArray(undefined);
			tree.insertArray('abc' as any);

			expect(tree.size()).toBe(0);
		});
	});

	describe('find and contains', () => {
		it('find returns the node at exactly the point', () => {
			tree.insertArray(randomPoints(200, 2));
			const target = tree.insert({x: 12.5, y: 7.25}) as QuadTreeElement<Pt>;

			expect(tree.find({x: 12.5, y: 7.25})).toBe(target);
			expect(tree.contains({x: 12.5, y: 7.25})).toBe(true);
			expect(tree.find({x: 12.5, y: 7.3})).toBeNull();
			expect(tree.contains({x: 12.5, y: 7.3})).toBe(false);
		});

		it('returns null for invalid points', () => {
			tree.insert({x: 0, y: 0});

			expect(tree.find(null as any)).toBeNull();
			expect(tree.find({x: NaN, y: 0})).toBeNull();
			expect(tree.find({} as any)).toBeNull();
		});

		it('finds every inserted item', () => {
			const points = randomPoints(300, 3);
			tree.insertArray(points);

			for (const point of points) {
				expect(tree.find(point)?.x()).toBe(point.x);
				expect(tree.find(point)?.y()).toBe(point.y);
			}
		});
	});

	describe('remove and removeNode', () => {
		it('remove matches the item itself, not an equal position', () => {
			const a = {x: 1, y: 1, id: 1};
			const b = {x: 1, y: 1, id: 2};
			tree.insertArray([a, b]);

			expect(tree.remove({x: 1, y: 1, id: 1})).toBeNull();
			expect(tree.remove(b)).toBe(b);
			expect(tree.size()).toBe(1);
			expect(tree.root()?.value()).toBe(a);
		});

		it('remove returns null for items not in the tree or without a position', () => {
			tree.insert({x: 1, y: 1});

			expect(tree.remove({x: 5, y: 5})).toBeNull();
			expect(tree.remove({x: NaN, y: 5})).toBeNull();
			expect(tree.size()).toBe(1);
		});

		it('removeNode returns null for foreign or removed nodes', () => {
			const other = new QuadTree<Pt>(byPoint);
			const foreign = other.insert({x: 1, y: 1}) as QuadTreeElement<Pt>;
			const node = tree.insert({x: 1, y: 1}) as QuadTreeElement<Pt>;

			expect(tree.removeNode(null)).toBeNull();
			expect(tree.removeNode(foreign)).toBeNull();
			expect(tree.removeNode(new QuadTreeElement<Pt>({x: 1, y: 1}))).toBeNull();
			expect(tree.removeNode(node)).not.toBeNull();
			expect(tree.removeNode(node)).toBeNull();
			expect(other.size()).toBe(1);
		});

		it('removing the root relinks every other node and keeps their handles', () => {
			const points = randomPoints(200, 4);
			const nodes = points.map((point) => tree.insert(point) as QuadTreeElement<Pt>);
			const root = tree.root()!;
			const rootItem = root.value();

			expect(tree.removeNode(root)).toBe(rootItem);
			expect(tree.size()).toBe(199);
			expectValid(tree);

			for (const node of nodes) {
				if (node !== root) {
					expect(node._tree).toBe(tree);
					expect(tree.find(node.value()!)).not.toBeNull();
				}
			}
		});

		it('removes every item in random order and stays valid', () => {
			const points = randomPoints(300, 5);
			tree.insertArray(points);
			const random = seeded(6);
			const order = points.slice().sort(() => random() - 0.5);

			for (let i = 0; i < order.length; i++) {
				expect(tree.remove(order[i])).toBe(order[i]);

				if (i % 25 === 0) {
					expectValid(tree);
				}
			}

			expect(tree.size()).toBe(0);
			expect(tree.root()).toBeNull();
		});
	});

	describe('update', () => {
		it('leaves the node in place when the position is unchanged', () => {
			const item = {x: 1, y: 1, id: 1};
			const node = tree.insert(item) as QuadTreeElement<Pt>;
			tree.insert({x: 2, y: 2});
			const copy = {x: 1, y: 1, id: 2};

			expect(tree.update(node, copy)).toBe(node);
			expect(node.value()).toBe(copy);
			expect(tree.root()).toBe(node);
		});

		it('moves an item changed in place and keeps the same node', () => {
			const points = randomPoints(100, 7);
			const nodes = points.map((point) => tree.insert(point) as QuadTreeElement<Pt>);
			const node = nodes[0];
			const item = node.value()!;
			item.x = 1000;
			item.y = -1000;

			expect(tree.update(node, item)).toBe(node);
			expect(node.x()).toBe(1000);
			expect(node.y()).toBe(-1000);
			expect(tree.find({x: 1000, y: -1000})).toBe(node);
			expect(tree.size()).toBe(100);
			expectValid(tree);
		});

		it('removes the node when the new position is invalid', () => {
			const node = tree.insert({x: 1, y: 1}) as QuadTreeElement<Pt>;

			expect(tree.update(node, {x: NaN, y: 1})).toBe('invalid_position');
			expect(tree.size()).toBe(0);
		});

		it('removes the node when it would duplicate and duplicates are not allowed', () => {
			const unique = new QuadTree<Pt>(byPoint, [{x: 1, y: 1}], {allowDuplicates: false});
			const node = unique.insert({x: 2, y: 2}) as QuadTreeElement<Pt>;

			expect(unique.update(node, {x: 1, y: 1})).toBe('duplicate_not_allowed');
			expect(unique.size()).toBe(1);
			expectValid(unique);
		});

		it('returns null for foreign nodes', () => {
			expect(tree.update(null, {x: 1, y: 1})).toBeNull();
			expect(tree.update(new QuadTreeElement<Pt>(), {x: 1, y: 1})).toBeNull();
		});
	});

	describe('spatial searches', () => {
		const points = randomPoints(400, 8);

		beforeEach(() => {
			tree.insertArray(points);
		});

		it('withinBounds matches a brute force scan, edges included', () => {
			const random = seeded(9);

			for (let i = 0; i < 50; i++) {
				const x1 = Math.round(random() * 100);
				const x2 = Math.round(random() * 100);
				const y1 = Math.round(random() * 100);
				const y2 = Math.round(random() * 100);
				const bounds = {
					minX: Math.min(x1, x2),
					maxX: Math.max(x1, x2),
					minY: Math.min(y1, y2),
					maxY: Math.max(y1, y2)
				};
				const expected = points
					.filter(
						(p) =>
							p.x >= bounds.minX &&
							p.x <= bounds.maxX &&
							p.y >= bounds.minY &&
							p.y <= bounds.maxY
					)
					.map((p) => p.id!)
					.sort((a, b) => a - b);

				expect(ids(tree.withinBounds(bounds))).toEqual(expected);
			}
		});

		it('withinBounds returns results in pre-order', () => {
			const all = tree.withinBounds({minX: -1, minY: -1, maxX: 101, maxY: 101});

			expect(all).toEqual(tree.toArray());
		});

		it('withinBounds returns an empty array for invalid bounds', () => {
			expect(tree.withinBounds(null as any)).toEqual([]);
			expect(tree.withinBounds({minX: 5, maxX: 1, minY: 0, maxY: 10})).toEqual([]);
			expect(tree.withinBounds({minX: 0, maxX: Infinity, minY: 0, maxY: 10})).toEqual([]);
			expect(tree.withinBounds({minX: 0, maxX: 1} as any)).toEqual([]);
		});

		it('withinRadius matches a brute force scan, boundary included', () => {
			const random = seeded(10);

			for (let i = 0; i < 50; i++) {
				const center = {x: Math.round(random() * 100), y: Math.round(random() * 100)};
				const radius = Math.round(random() * 30);
				const expected = points
					.filter((p) => distance(p, center) <= radius)
					.map((p) => p.id!)
					.sort((a, b) => a - b);

				expect(ids(tree.withinRadius(center, radius))).toEqual(expected);
			}
		});

		it('withinRadius with radius 0 finds exact matches', () => {
			const target = points[0];

			expect(tree.withinRadius(target, 0).every((n) => n.x() === target.x && n.y() === target.y)).toBe(
				true
			);
			expect(tree.withinRadius(target, 0).length).toBeGreaterThan(0);
		});

		it('withinRadius returns an empty array for invalid input', () => {
			expect(tree.withinRadius({x: 0, y: 0}, -1)).toEqual([]);
			expect(tree.withinRadius({x: 0, y: 0}, NaN)).toEqual([]);
			expect(tree.withinRadius({x: 0, y: 0}, Infinity)).toEqual([]);
			expect(tree.withinRadius({x: NaN, y: 0}, 5)).toEqual([]);
		});

		it('nearest matches a brute force scan', () => {
			const random = seeded(11);

			for (let i = 0; i < 100; i++) {
				const target = {x: random() * 140 - 20, y: random() * 140 - 20};
				const best = Math.min(...points.map((p) => distance(p, target)));
				const found = tree.nearest(target)!;

				expect(distance(found.value()!, target)).toBe(best);
			}
		});

		it('nearest returns null for an empty tree or an invalid point', () => {
			expect(tree.nearest({x: NaN, y: 0})).toBeNull();
			expect(new QuadTree<Pt>(byPoint).nearest({x: 0, y: 0})).toBeNull();
		});
	});

	describe('shape', () => {
		it('height and depth follow the links', () => {
			expect(tree.height()).toBe(-1);

			const root = tree.insert({x: 0, y: 0}) as QuadTreeElement<Pt>;
			expect(tree.height()).toBe(0);

			const a = tree.insert({x: 1, y: 1}) as QuadTreeElement<Pt>;
			const b = tree.insert({x: 2, y: 2}) as QuadTreeElement<Pt>;
			tree.insert({x: -1, y: -1});

			expect(tree.height()).toBe(2);
			expect(tree.depth(root)).toBe(0);
			expect(tree.depth(a)).toBe(1);
			expect(tree.depth(b)).toBe(2);
			expect(tree.depth(null)).toBeNull();
			expect(tree.depth(new QuadTreeElement<Pt>())).toBeNull();
		});
	});

	describe('traversal', () => {
		// Root 0 holds 2 (NE), 3 (NW), and 1 (SW). 2 holds 4 and 1 holds 5.
		const items: Pt[] = [
			{x: 0, y: 0, id: 0},
			{x: -5, y: -5, id: 1},
			{x: 5, y: 5, id: 2},
			{x: -5, y: 5, id: 3},
			{x: 6, y: 6, id: 4},
			{x: -6, y: -6, id: 5}
		];
		const idsOf = (values: Pt[]): number[] => values.map((v) => v.id!);

		beforeEach(() => {
			tree.insertArray(items);
		});

		it('preOrder visits each node before its quadrants, in quadrant order', () => {
			expect(idsOf(tree.preOrder())).toEqual([0, 2, 4, 3, 1, 5]);
			expect(idsOf(tree.values())).toEqual([0, 2, 4, 3, 1, 5]);
		});

		it('postOrder visits each node after its quadrants', () => {
			expect(idsOf(tree.postOrder())).toEqual([4, 2, 3, 5, 1, 0]);
		});

		it('levelOrder visits level by level', () => {
			expect(idsOf(tree.levelOrder())).toEqual([0, 2, 3, 1, 4, 5]);
		});

		it('iterates in pre-order', () => {
			expect(idsOf([...tree] as Pt[])).toEqual([0, 2, 4, 3, 1, 5]);
			expect(tree[Symbol.iterator]()).toBeInstanceOf(QuadTreeIterator);
			expect([...new QuadTree<Pt>(byPoint)]).toEqual([]);
		});

		it('preOrderNext walks the whole tree and rejects foreign nodes', () => {
			const walked: number[] = [];
			let node = tree.root();

			while (node) {
				walked.push(node.value()!.id!);
				node = tree.preOrderNext(node);
			}

			expect(walked).toEqual([0, 2, 4, 3, 1, 5]);
			expect(tree.preOrderNext(null)).toBeNull();
			expect(tree.preOrderNext(new QuadTreeElement<Pt>())).toBeNull();
		});

		it('toArray returns nodes in pre-order', () => {
			expect(tree.toArray().map((n) => n.value()!.id)).toEqual([0, 2, 4, 3, 1, 5]);
		});
	});

	describe('forEach and filter', () => {
		it('forEach passes element, index, and tree with thisArg', () => {
			tree.insertArray(randomPoints(20, 12));
			const seen: number[] = [];
			const context = {calls: 0};

			tree.forEach(function (this: typeof context, elem, idx, t) {
				this.calls++;
				seen.push(idx);
				expect(t).toBe(tree);
				expect(elem).toBeInstanceOf(QuadTreeElement);
			}, context);

			expect(context.calls).toBe(20);
			expect(seen).toEqual([...Array(20).keys()]);
		});

		it('forEach survives removal of the current and later elements', () => {
			tree.insertArray(randomPoints(100, 13));
			const nodes = tree.toArray();
			let visited = 0;

			tree.forEach((elem, idx) => {
				visited++;
				tree.removeNode(elem);

				// Also remove an element not visited yet.
				const later = nodes[nodes.length - 1 - idx];
				if (later._tree === tree) {
					tree.removeNode(later);
				}
			});

			expect(visited).toBe(50);
			expect(tree.size()).toBe(0);
		});

		it('filter keeps the shape when every item is kept', () => {
			tree.insertArray(randomPoints(100, 14));
			const copy = tree.filter(() => true);

			expect(copy).not.toBe(tree);
			expect(copy.locator).toBe(tree.locator);
			expect(copy.preOrder()).toEqual(tree.preOrder());
			expect(copy.levelOrder()).toEqual(tree.levelOrder());
			expectValid(copy);
		});

		it('filter keeps only matching items', () => {
			tree.insertArray(randomPoints(100, 15));
			const result = tree.filter((elem) => elem.x() < 50);

			expect(result.values().every((p) => p.x < 50)).toBe(true);
			expect(result.size()).toBe(tree.values().filter((p) => p.x < 50).length);
			expectValid(result);
		});
	});

	describe('query', () => {
		beforeEach(() => {
			tree.insertArray(randomPoints(50, 16));
		});

		it('returns matching elements in pre-order', () => {
			const results = tree.query((p) => p.x > 50);
			const expected = tree.toArray().filter((n) => n.value()!.x > 50);

			expect(results.map((r) => r.element)).toEqual(expected);
			expect(results[0].key()).toBeNull();
			expect(results[0].index()).toBeNull();
		});

		it('requires every filter to pass and honors limit', () => {
			const results = tree.query([(p) => p.x > 20, (p) => p.y > 20], {limit: 3});

			expect(results.length).toBeLessThanOrEqual(3);
			expect(results.every((r) => r.element.x() > 20 && r.element.y() > 20)).toBe(true);
			expect(tree.query([])).toEqual([]);
		});

		it('delete removes the match once, and not a recycled node', () => {
			const [first] = tree.query(() => true, {limit: 1});
			const item = first.element.value();

			expect(first.delete()).toBe(item);
			expect(tree.size()).toBe(49);
			expect(first.delete()).toBeNull();

			// The recycled node now holds a different item.
			const reissued = tree.insert({x: 1, y: 1}) as QuadTreeElement<Pt>;
			expect(reissued).toBe(first.element);
			expect(first.delete()).toBeNull();
			expect(tree.size()).toBe(50);
		});
	});

	describe('stringify', () => {
		it('serializes items in pre-order', () => {
			tree.insertArray([
				{x: 0, y: 0},
				{x: 1, y: 1}
			]);

			expect(tree.stringify()).toBe('{"type":"QuadTree","elements":[{"x":0,"y":0},{"x":1,"y":1}]}');
		});

		it('returns null for items that cannot be serialized', () => {
			const circular: any = {x: 0, y: 0};
			circular.self = circular;
			tree.insert(circular);

			expect(tree.stringify()).toBeNull();
		});
	});

	describe('clearElements and reset', () => {
		it('unlinks every node and keeps the locator and options', () => {
			const unique = new QuadTree<Pt>(byPoint, randomPoints(30, 17), {allowDuplicates: false});
			const nodes = unique.toArray();
			unique.reset();

			expect(unique.size()).toBe(0);
			expect(unique.root()).toBeNull();
			expect(unique.allowDuplicates).toBe(false);
			expect(nodes.every((n) => n._tree === null && n.parent() === null && n.isLeaf())).toBe(true);

			unique.insert({x: 1, y: 1});
			expect(unique.size()).toBe(1);
		});
	});
});
