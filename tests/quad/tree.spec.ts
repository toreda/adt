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

		it('releases every node back to the pool', () => {
			const pooled = new QuadTree<Pt>(byPoint, randomPoints(200, 18));
			const nodes = pooled.toArray();
			expect(poolOf(pooled)!.size()).toBe(200);

			pooled.clearElements();

			expect(poolOf(pooled)!.size()).toBe(0);
			expect(nodes.every((n) => n._tree === null && n.value() === null && n.isLeaf())).toBe(true);
			expect(pooled.insert({x: 1, y: 1})).toBeInstanceOf(QuadTreeElement);
			expectValid(pooled);
		});

		it('unlinks every node when pooling is off', () => {
			const unpooled = new QuadTree<Pt>(byPoint, randomPoints(200, 19), {disableElementPooling: true});
			const nodes = unpooled.toArray();
			unpooled.clearElements();

			expect(unpooled.root()).toBeNull();
			expect(
				nodes.every((n) => n._tree === null && n._linkId === 0 && n.parent() === null && n.isLeaf())
			).toBe(true);
		});
	});

	describe('HOT PATH', () => {
		/** Internal scratch state must be empty between calls, holding no nodes. */
		const expectScratchClean = (target: QuadTree<any>): void => {
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
		const expectedAfterRemoval = (source: QuadTree<Pt>, node: QuadTreeElement<Pt>): Pt[] => {
			const inside = new Set<QuadTreeElement<Pt>>();
			const stack = [node];

			while (stack.length) {
				const curr = stack.pop()!;
				inside.add(curr);
				stack.push(...curr.children());
			}

			const all = source.toArray();
			const outside = all.filter((n) => !inside.has(n)).map((n) => n.value()!);
			const orphans = all.filter((n) => inside.has(n) && n !== node).map((n) => n.value()!);

			return new QuadTree<Pt>(byPoint, [...outside, ...orphans]).preOrder();
		};

		describe('withinBounds with an out array', () => {
			it('fills and returns the given array, replacing its contents', () => {
				tree.insertArray(randomPoints(300, 20));
				const out: QuadTreeElement<Pt>[] = [tree.root()!, tree.root()!, tree.root()!];
				const bounds = {minX: 10, minY: 10, maxX: 60, maxY: 40};

				const result = tree.withinBounds(bounds, out);

				expect(result).toBe(out);
				expect(out).toEqual(tree.withinBounds(bounds));
			});

			it('shrinks the array when fewer nodes match, and empties it on invalid bounds', () => {
				tree.insertArray(randomPoints(300, 21));
				const out: QuadTreeElement<Pt>[] = [];

				tree.withinBounds({minX: 0, minY: 0, maxX: 100, maxY: 100}, out);
				expect(out.length).toBe(300);

				tree.withinBounds({minX: 0, minY: 0, maxX: 10, maxY: 10}, out);
				expect(out).toEqual(tree.withinBounds({minX: 0, minY: 0, maxX: 10, maxY: 10}));

				expect(tree.withinBounds({minX: 5, minY: 0, maxX: 1, maxY: 1}, out)).toBe(out);
				expect(out.length).toBe(0);
			});

			it('ignores a non-array out and returns a new array', () => {
				tree.insert({x: 1, y: 1});

				expect(tree.withinBounds({minX: 0, minY: 0, maxX: 2, maxY: 2}, 'nope' as any).length).toBe(1);
				expect(tree.withinBounds({minX: 0, minY: 0, maxX: 2, maxY: 2}, null).length).toBe(1);
			});

			it('empties out for an empty tree', () => {
				const out = [new QuadTreeElement<Pt>()];

				expect(tree.withinBounds({minX: 0, minY: 0, maxX: 1, maxY: 1}, out)).toBe(out);
				expect(out.length).toBe(0);
			});
		});

		describe('withinRadius with an out array', () => {
			it('fills and returns the given array, matching a brute force scan', () => {
				const points = randomPoints(300, 22);
				tree.insertArray(points);
				const out: QuadTreeElement<Pt>[] = [];
				const random = seeded(23);

				for (let i = 0; i < 30; i++) {
					const center = {x: random() * 100, y: random() * 100};
					const radius = random() * 30;
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
				const out = tree.withinRadius({x: 50, y: 50}, 100);
				expect(out.length).toBe(20);

				expect(tree.withinRadius({x: 50, y: 50}, -1, out)).toBe(out);
				expect(out.length).toBe(0);
			});
		});

		it('searches leave the scratch stacks empty and do not grow them once warm', () => {
			tree.insertArray(randomPoints(500, 25));
			const internal = tree as any;
			const random = seeded(26);
			const out: QuadTreeElement<Pt>[] = [];

			const run = (): void => {
				for (let i = 0; i < 50; i++) {
					const point = {x: random() * 100, y: random() * 100};
					tree.nearest(point);
					tree.withinRadius(point, 15, out);
					tree.withinBounds(
						{minX: point.x, minY: point.y, maxX: point.x + 20, maxY: point.y + 20},
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
				const target = {x: random() * 140 - 20, y: random() * 140 - 20};
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
					const nodes = tree.toArray();
					const inner = nodes.filter((n) => !n.isLeaf());
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

				expect(tree.update(leaf, item)).toBe(leaf);

				others.forEach((n, i) => expect(n.parent()).toBe(parents[i]));
				expect(tree.find({x: 250, y: 250})).toBe(leaf);
				expectValid(tree);
			});

			it('moving an inner node with update keeps every handle valid', () => {
				const points = randomPoints(200, 33);
				const nodes = points.map((p) => tree.insert(p) as QuadTreeElement<Pt>);
				const random = seeded(34);

				for (let i = 0; i < 200; i++) {
					const node = nodes[Math.floor(random() * nodes.length)];
					const item = node.value()!;
					item.x = Math.round(random() * 100);
					item.y = Math.round(random() * 100);

					expect(tree.update(node, item)).toBe(node);
				}

				expect(tree.size()).toBe(200);
				expectValid(tree);
				expectScratchClean(tree);
			});
		});

		describe('duplicate check folded into the descent', () => {
			it('rejects a duplicate of a node deep in the tree', () => {
				const unique = new QuadTree<Pt>(byPoint, [], {allowDuplicates: false});
				unique.insertArray(randomPoints(300, 35));
				const deepest = unique
					.toArray()
					.reduce((a, b) => (unique.depth(b)! > unique.depth(a)! ? b : a));
				const size = unique.size();

				expect(unique.insert({x: deepest.x(), y: deepest.y()})).toBe('duplicate_not_allowed');
				expect(unique.size()).toBe(size);
				expectValid(unique);
				expectScratchClean(unique);
			});

			it('update to an occupied position deep in the tree removes the node', () => {
				const unique = new QuadTree<Pt>(byPoint, [], {allowDuplicates: false});
				unique.insertArray(randomPoints(300, 36));
				const nodes = unique.toArray();
				const deepest = nodes.reduce((a, b) => (unique.depth(b)! > unique.depth(a)! ? b : a));
				const mover = nodes[0];
				const item = mover.value()!;
				item.x = deepest.x();
				item.y = deepest.y();
				const size = unique.size();

				expect(unique.update(mover, item)).toBe('duplicate_not_allowed');
				expect(unique.size()).toBe(size - 1);
				expect(mover._tree).toBeNull();
				expect(unique.find({x: item.x, y: item.y})).toBe(deepest);
				expectValid(unique);
			});

			it('insert with duplicates rejected keeps every unique position', () => {
				const unique = new QuadTree<Pt>(byPoint, [], {allowDuplicates: false});
				const points = randomPoints(500, 37, 20);
				unique.insertArray(points);
				const positions = new Set(points.map((p) => `${p.x},${p.y}`));

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

				expect(pairs.length).toBe(400);
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
				const seen = new Set<QuadTreeElement<Pt>>();
				let visits = 0;

				tree.forEach((elem, idx) => {
					visits++;
					seen.add(elem);
					// Move this element and remove one far ahead.
					const item = elem.value()!;
					item.x = 100 - item.x;
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
				const second = iterator.next();

				expect(second).toBe(first);
				expect(first.done).toBe(false);
			});

			it('yields every item then done, repeatedly', () => {
				const points = randomPoints(50, 43);
				tree.insertArray(points);
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
				// Root 0 then 1 (NE of root) then 2 (NE of 1).
				tree.insertArray([
					{x: 0, y: 0, id: 0},
					{x: 1, y: 1, id: 1},
					{x: 2, y: 2, id: 2}
				]);
				const seen: Array<Pt | null> = [];

				for (const item of tree) {
					seen.push(item);

					if (item!.id === 0) {
						tree.remove(tree.find({x: 1, y: 1})!.value()!);
					}
				}

				// Node 1 was due next and is gone: no stray null, no removed item.
				expect(seen.map((v) => v?.id)).toEqual([0]);
			});

			it('ends instead of yielding a removed item with pooling off', () => {
				const unpooled = new QuadTree<Pt>(byPoint, [], {disableElementPooling: true});
				const removed = {x: 1, y: 1, id: 1};
				unpooled.insertArray([{x: 0, y: 0, id: 0}, removed, {x: 2, y: 2, id: 2}]);
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
					{x: 0, y: 0, id: 0},
					{x: 1, y: 1, id: 1}
				]);
				const iterator = tree[Symbol.iterator]();
				iterator.next();

				const due = tree.find({x: 1, y: 1})!;
				tree.removeNode(due);
				// Recycled with a new link id, holding a different item.
				expect(tree.insert({x: 5, y: 5, id: 9})).toBe(due);

				expect(iterator.next().done).toBe(true);
			});
		});

		describe('height', () => {
			it('matches a recursive depth scan', () => {
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
					tree.insert({x: i, y: i});
				}

				expect(tree.height()).toBe(49);
			});
		});

		describe('traversals keep the scratch stack clean', () => {
			it('postOrder and levelOrder', () => {
				tree.insertArray(randomPoints(100, 45));

				expect(tree.postOrder().length).toBe(100);
				expectScratchClean(tree);
				expect(tree.levelOrder().length).toBe(100);
				expectScratchClean(tree);
				expect(tree.values()).toEqual(tree.toArray().map((n) => n.value()));
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
				expect(tree.query(() => true, {limit: '3' as any}).length).toBe(10);
			});

			it('stops at the first failing filter', () => {
				tree.insertArray(randomPoints(10, 48));
				const second = jest.fn(() => true);

				expect(tree.query([() => false, second])).toEqual([]);
				expect(second).not.toHaveBeenCalled();
			});
		});

		describe('children with an out array', () => {
			it('fills and returns the given array', () => {
				tree.insertArray([
					{x: 0, y: 0},
					{x: 1, y: 1},
					{x: -1, y: -1}
				]);
				const root = tree.root()!;
				const out: QuadTreeElement<Pt>[] = [root, root, root, root];

				expect(root.children(out)).toBe(out);
				expect(out).toEqual([root.child(0), root.child(3)]);
				expect(root.child(0)!.children(out)).toEqual([]);
				expect(root.children()).toEqual([root.child(0), root.child(3)]);
			});
		});

		describe('forEachWithinBounds and forEachWithinRadius', () => {
			type El = QuadTreeElement<Pt>;

			const visitBounds = (target: QuadTree<Pt>, bounds: any): El[] => {
				const seen: El[] = [];
				target.forEachWithinBounds(bounds, (element) => {
					seen.push(element);
				});
				return seen;
			};

			const visitRadius = (target: QuadTree<Pt>, point: any, radius: any): El[] => {
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
				const y2 = Math.round(random() * 100);
				return {
					minX: Math.min(x1, x2),
					minY: Math.min(y1, y2),
					maxX: Math.max(x1, x2),
					maxY: Math.max(y1, y2)
				};
			};

			it('visit the same nodes in the same order as the array methods, on random data', () => {
				tree.insertArray(randomPoints(400, 60));
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

					const center = {x: random() * 120 - 10, y: random() * 120 - 10};
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
				const points = randomPoints(300, 62);
				tree.insertArray(points);
				const center = {x: 40, y: 55};
				const byId = (nodes: El[]): number[] => ids(nodes);

				expect(byId(visitRadius(tree, center, 20))).toEqual(
					points.filter((p) => distance(p, center) <= 20).map((p) => p.id!)
				);
				expect(byId(visitBounds(tree, {minX: 10, minY: 20, maxX: 50, maxY: 70}))).toEqual(
					points.filter((p) => p.x >= 10 && p.x <= 50 && p.y >= 20 && p.y <= 70).map((p) => p.id!)
				);
			});

			it('call func with thisArg as this, and undefined when omitted', () => {
				tree.insertArray(randomPoints(20, 63));
				const context = {name: 'ctx'};
				const bounds = {minX: 0, minY: 0, maxX: 100, maxY: 100};
				const thisValues: unknown[] = [];
				const record = function (this: unknown): void {
					thisValues.push(this);
				};

				tree.forEachWithinBounds(bounds, record, context);
				tree.forEachWithinRadius({x: 50, y: 50}, 200, record, context);
				expect(thisValues.length).toBe(40);
				expect(thisValues.every((value) => value === context)).toBe(true);

				thisValues.length = 0;
				tree.forEachWithinBounds(bounds, record);
				tree.forEachWithinRadius({x: 50, y: 50}, 200, record);
				expect(thisValues.length).toBe(40);
				expect(thisValues.every((value) => value === undefined)).toBe(true);
			});

			it('visit nothing on invalid bounds, point, or radius', () => {
				tree.insertArray(randomPoints(50, 64));
				const func = jest.fn();
				const badBounds = [
					null,
					undefined,
					'bounds',
					{},
					{minX: 0, minY: 0, maxX: 10},
					{minX: NaN, minY: 0, maxX: 10, maxY: 10},
					{minX: 0, minY: 0, maxX: Infinity, maxY: 10},
					{minX: 20, minY: 0, maxX: 10, maxY: 10},
					{minX: 0, minY: 20, maxX: 10, maxY: 10},
					{minX: '0', minY: 0, maxX: 10, maxY: 10}
				];
				const badPoints = [
					null,
					undefined,
					5,
					{x: 1},
					{x: NaN, y: 1},
					{x: 1, y: -Infinity},
					{x: '1', y: 1}
				];
				const badRadii = [-1, NaN, Infinity, -Infinity, '5', null, undefined];

				for (const bounds of badBounds) {
					expect(tree.forEachWithinBounds(bounds as any, func)).toBe(tree);
				}

				for (const point of badPoints) {
					expect(tree.forEachWithinRadius(point as any, 10, func)).toBe(tree);
				}

				for (const radius of badRadii) {
					expect(tree.forEachWithinRadius({x: 50, y: 50}, radius as any, func)).toBe(tree);
				}

				expect(func).not.toHaveBeenCalled();
				expectScratchClean(tree);
			});

			it('visit nothing on an empty tree', () => {
				const func = jest.fn();

				expect(tree.forEachWithinBounds({minX: -1e9, minY: -1e9, maxX: 1e9, maxY: 1e9}, func)).toBe(
					tree
				);
				expect(tree.forEachWithinRadius({x: 0, y: 0}, 1e9, func)).toBe(tree);
				expect(func).not.toHaveBeenCalled();
				expectScratchClean(tree);
			});

			it('radius 0 visits only nodes exactly at point', () => {
				tree.insertArray([
					{x: 5, y: 5, id: 0},
					{x: 5, y: 5, id: 1},
					{x: 5, y: 6, id: 2}
				]);

				expect(ids(visitRadius(tree, {x: 5, y: 5}, 0))).toEqual([0, 1]);
			});

			describe('mutation from func', () => {
				for (const pooling of [true, false]) {
					const label = pooling ? 'pooling on' : 'pooling off';
					const make = (): QuadTree<Pt> =>
						new QuadTree<Pt>(byPoint, randomPoints(300, 65), {disableElementPooling: !pooling});
					const bounds = {minX: 20, minY: 20, maxX: 70, maxY: 70};
					const center = {x: 45, y: 45};

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
								target.insert({x: center.x, y: center.y, id: -1});
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
							target.insert({x: 50, y: 50, id: -1});
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
					tree.insertArray(randomPoints(300, 66));
					const outer = {minX: 30, minY: 30, maxX: 40, maxY: 40};
					const inner = {minX: 0, minY: 0, maxX: 60, maxY: 60};
					const expectedInner = tree.withinBounds(inner);
					const expectedOuter = tree.withinBounds(outer);
					const expectedRadius = tree.withinRadius({x: 10, y: 80}, 15);
					const seen: El[] = [];

					tree.forEachWithinBounds(outer, (element) => {
						seen.push(element);
						expect(visitBounds(tree, inner)).toEqual(expectedInner);
						expect(visitRadius(tree, {x: 10, y: 80}, 15)).toEqual(expectedRadius);
						expect(tree.withinBounds(inner)).toEqual(expectedInner);
						expect(tree.withinRadius({x: 10, y: 80}, 15)).toEqual(expectedRadius);
						const near = tree.nearest({x: element.x(), y: element.y()})!;
						expect([near.x(), near.y()]).toEqual([element.x(), element.y()]);

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
					tree.insertArray(randomPoints(300, 67));
					const big = {minX: 0, minY: 0, maxX: 100, maxY: 100};
					const small = {minX: 0, minY: 0, maxX: 15, maxY: 15};

					expect(visitBounds(tree, big)).toEqual(tree.withinBounds(big));
					expect(visitBounds(tree, small)).toEqual(tree.withinBounds(small));
					expect(visitRadius(tree, {x: 50, y: 50}, 100)).toEqual(
						tree.withinRadius({x: 50, y: 50}, 100)
					);
					expect(visitRadius(tree, {x: 90, y: 5}, 5)).toEqual(tree.withinRadius({x: 90, y: 5}, 5));
					expect(visitBounds(tree, {minX: 5, minY: 0, maxX: 1, maxY: 1})).toEqual([]);
					expectScratchClean(tree);
				});

				it('releases the snapshot when func throws', () => {
					tree.insertArray(randomPoints(100, 68));
					const bounds = {minX: 0, minY: 0, maxX: 100, maxY: 100};
					const error = new Error('stop');

					expect(() =>
						tree.forEachWithinBounds(bounds, () => {
							throw error;
						})
					).toThrow(error);
					expectScratchClean(tree);

					expect(() =>
						tree.forEachWithinRadius({x: 50, y: 50}, 30, () => {
							throw error;
						})
					).toThrow(error);
					expectScratchClean(tree);

					expect(visitBounds(tree, bounds)).toEqual(tree.withinBounds(bounds));
				});

				it('do not grow the scratch arrays once warm', () => {
					tree.insertArray(randomPoints(500, 69));
					const internal = tree as any;
					const random = seeded(70);
					const func = (): void => {};

					tree.forEachWithinBounds({minX: 0, minY: 0, maxX: 100, maxY: 100}, func);
					tree.forEachWithinRadius({x: 50, y: 50}, 200, func);
					const eachLength = internal.eachNodes.length;
					const idsLength = internal.eachLinkIds.length;
					const stackLength = internal.stackNodes.length;
					const regionsLength = internal.stackRegions.length;

					for (let i = 0; i < 50; i++) {
						tree.forEachWithinBounds(randomBounds(random), func);
						tree.forEachWithinRadius({x: random() * 100, y: random() * 100}, random() * 40, func);
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
