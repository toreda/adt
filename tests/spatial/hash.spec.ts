import {ObjectPool} from '../../src/object/pool';
import {SpatialElement} from '../../src/spatial/element';
import {SpatialHash} from '../../src/spatial/hash';
import {SpatialIterator} from '../../src/spatial/iterator';
import type {SpatialPoint} from '../../src/spatial/point';
import {byPoint, distance, expectValid, gridOf, ids, type Pt, randomPoints, seeded} from './_helpers';

const poolOf = (target: SpatialHash<any>): ObjectPool<any> | null =>
	(gridOf(target) as any).elements.objectPool;

const hash = new SpatialHash<Pt>(byPoint);

describe('SpatialHash', () => {
	beforeEach(() => {
		hash.reset();
		expect(hash.isEmpty()).toBe(true);
	});

	describe('INSTANTIATION', () => {
		it('with only a locator', () => {
			const result = new SpatialHash<Pt>(byPoint);

			expect(result.size()).toBe(0);
			expect(result.cellCount()).toBe(0);
			expect(result.locator).toBe(byPoint);
			expect(result.cellSize).toBe(1);
			expect(result.values()).toEqual([]);
		});

		it('throws when locator is not a function', () => {
			expect(() => new SpatialHash<Pt>(null as any)).toThrow('SpatialHash requires a locator function');
			expect(() => new SpatialHash<Pt>({} as any)).toThrow();
		});

		it('inserts data in array order', () => {
			const items = randomPoints(40, 1);
			const result = new SpatialHash<Pt>(byPoint, items);

			expect(result.size()).toBe(40);
			expect(result.values()).toEqual(items);
			expectValid(result);
		});

		it('ignores non-array data and items without a valid position', () => {
			expect(new SpatialHash<Pt>(byPoint, 'x' as any).size()).toBe(0);
			expect(new SpatialHash<Pt>(byPoint, {} as any).size()).toBe(0);

			const result = new SpatialHash<Pt>(byPoint, [
				{x: 1, y: 1, z: 1},
				{x: NaN, y: 1, z: 1},
				null as any,
				{x: 2, y: 2, z: 2}
			]);
			expect(result.size()).toBe(2);
		});

		it('uses cellSize when a finite number greater than 0', () => {
			expect(new SpatialHash<Pt>(byPoint, null, {cellSize: 0.25}).cellSize).toBe(0.25);
			expect(new SpatialHash<Pt>(byPoint, null, {cellSize: 64}).cellSize).toBe(64);
		});

		it.each([0, -1, NaN, Infinity, '5', null])('falls back to cellSize 1 for %p', (cellSize) => {
			expect(new SpatialHash<Pt>(byPoint, null, {cellSize: cellSize as any}).cellSize).toBe(1);
		});

		it('sizes the table from expectedCellCount, falling back when invalid', () => {
			const capacityOf = (count: unknown): number =>
				(gridOf(new SpatialHash<Pt>(byPoint, null, {expectedCellCount: count as any})) as any)
					.tableCapacity;

			expect(capacityOf(1000)).toBe(2048);
			expect(capacityOf(1)).toBe(8);
			expect(capacityOf(undefined)).toBe(128);
			expect(capacityOf(0)).toBe(128);
			expect(capacityOf(-5)).toBe(128);
			expect(capacityOf(2.5)).toBe(128);
		});
	});

	describe('insert', () => {
		it('returns the element holding the item at its position and cell', () => {
			const item = {x: 1.5, y: -2.5, z: 7, id: 1};
			const result = hash.insert(item) as SpatialElement<Pt>;

			expect(result).toBeInstanceOf(SpatialElement);
			expect(result.value()).toBe(item);
			expect([result.x(), result.y(), result.z()]).toEqual([1.5, -2.5, 7]);
			expect([result.cellX(), result.cellY(), result.cellZ()]).toEqual([1, -3, 7]);
			expect(hash.size()).toBe(1);
			expectValid(hash);
		});

		it('allows many items in one cell and at one position', () => {
			for (let i = 0; i < 10; i++) {
				hash.insert({x: 0.5, y: 0.5, z: 0.5, id: i});
				hash.insert({x: 0.1 * i, y: 0.2, z: 0.3, id: 100 + i});
			}

			expect(hash.size()).toBe(20);
			expect(hash.cellCount()).toBe(1);
			expectValid(hash);
		});

		it.each([
			['null', null],
			['non-object', 5],
			['NaN coordinate', {x: NaN, y: 0, z: 0}],
			['missing z', {x: 0, y: 0}],
			['infinite coordinate', {x: 0, y: Infinity, z: 0}],
			['string coordinate', {x: '1', y: 0, z: 0}],
			['cell out of int32 range', {x: 1e300, y: 0, z: 0}]
		])('refuses %s with invalid_position', (_label, point) => {
			const target = new SpatialHash<any>(() => point as any);

			expect(target.insert({})).toBe('invalid_position');
			expect(target.size()).toBe(0);
		});

		it('accepts cells at both ends of the int32 range', () => {
			const target = new SpatialHash<Pt>(byPoint);
			const low = {x: -2147483648, y: 0, z: 0};
			const high = {x: 2147483647.5, y: 0, z: 0};

			expect(target.insert(low)).toBeInstanceOf(SpatialElement);
			expect(target.insert(high)).toBeInstanceOf(SpatialElement);
			expect(target.insert({x: -2147483649, y: 0, z: 0})).toBe('invalid_position');
			expect(target.insert({x: 2147483648, y: 0, z: 0})).toBe('invalid_position');
			expect(target.nearest({x: 2147483647, y: 0, z: 0})!.value()).toBe(high);
			expect(target.nearest({x: 1e12, y: 0, z: 0})!.value()).toBe(high);
			expectValid(target);
		});

		it('insertArray ignores non-arrays', () => {
			hash.insertArray(null);
			hash.insertArray('abc' as any);
			expect(hash.size()).toBe(0);
		});
	});

	describe('find and contains', () => {
		it('finds an item at exactly a point', () => {
			const a = {x: 0.25, y: 0.25, z: 0.25, id: 1};
			const b = {x: 0.75, y: 0.25, z: 0.25, id: 2};
			hash.insertArray([a, b]);

			expect(hash.find({x: 0.75, y: 0.25, z: 0.25})!.value()).toBe(b);
			expect(hash.find({x: 0.5, y: 0.25, z: 0.25})).toBeNull();
			expect(hash.contains({x: 0.25, y: 0.25, z: 0.25})).toBe(true);
			expect(hash.contains({x: 5, y: 5, z: 5})).toBe(false);
		});

		it('returns null for invalid points', () => {
			hash.insert({x: 0, y: 0, z: 0});

			expect(hash.find(null as any)).toBeNull();
			expect(hash.find({x: NaN, y: 0, z: 0})).toBeNull();
			expect(hash.contains({} as any)).toBe(false);
		});
	});

	describe('remove and removeNode', () => {
		it('removes an item by identity, leaving others in its cell', () => {
			const a = {x: 1, y: 1, z: 1, id: 1};
			const b = {x: 1, y: 1, z: 1, id: 2};
			hash.insertArray([a, b]);

			expect(hash.remove({x: 1, y: 1, z: 1, id: 1})).toBeNull();
			expect(hash.remove(a)).toBe(a);
			expect(hash.remove(a)).toBeNull();
			expect(hash.values()).toEqual([b]);
			expectValid(hash);
		});

		it('frees a cell once its last item is removed', () => {
			const a = {x: 1, y: 1, z: 1};
			hash.insert(a);
			expect(hash.cellCount()).toBe(1);

			hash.remove(a);
			expect(hash.cellCount()).toBe(0);
			expectValid(hash);
		});

		it('remove misses an item moved in place until updated', () => {
			const a = {x: 1, y: 1, z: 1};
			const node = hash.insert(a) as SpatialElement<Pt>;
			a.x = 30;

			expect(hash.remove(a)).toBeNull();
			hash.update(node, a);
			expect(hash.remove(a)).toBe(a);
		});

		it('remove returns null for items without a valid position', () => {
			expect(hash.remove({x: NaN, y: 0, z: 0})).toBeNull();
		});

		it('removeNode unlinks the element', () => {
			const a = {x: 1, y: 2, z: 3};
			const node = hash.insert(a) as SpatialElement<Pt>;

			expect(hash.removeNode(node)).toBe(a);
			expect(hash.size()).toBe(0);
			expect(hash.removeNode(node)).toBeNull();
			expect(hash.removeNode(null)).toBeNull();
		});

		it('removeNode ignores elements of another hash', () => {
			const other = new SpatialHash<Pt>(byPoint);
			const node = other.insert({x: 1, y: 1, z: 1}) as SpatialElement<Pt>;

			expect(hash.removeNode(node)).toBeNull();
			expect(other.size()).toBe(1);
		});

		it('keeps insertion order through removals from the ends and middle', () => {
			const items = randomPoints(6, 3);
			const nodes = items.map((item) => hash.insert(item) as SpatialElement<Pt>);

			hash.removeNode(nodes[0]);
			hash.removeNode(nodes[5]);
			hash.removeNode(nodes[2]);

			expect(hash.values()).toEqual([items[1], items[3], items[4]]);
			expectValid(hash);
		});
	});

	describe('update', () => {
		it('moves an element to its item position, keeping identity and order', () => {
			const items = randomPoints(5, 4);
			const nodes = items.map((item) => hash.insert(item) as SpatialElement<Pt>);
			const moved = {x: 400, y: -300, z: 20, id: 99};

			expect(hash.update(nodes[2], moved)).toBe(nodes[2]);
			expect(nodes[2].value()).toBe(moved);
			expect(nodes[2].x()).toBe(400);
			expect(hash.values()).toEqual([items[0], items[1], moved, items[3], items[4]]);
			expect(hash.find({x: 400, y: -300, z: 20})).toBe(nodes[2]);
			expectValid(hash);
		});

		it('moves within a cell without changing cell lists', () => {
			const item = {x: 0.1, y: 0.1, z: 0.1};
			const node = hash.insert(item) as SpatialElement<Pt>;
			const slot = node._slot;
			item.x = 0.9;

			expect(hash.update(node, item)).toBe(node);
			expect(node._slot).toBe(slot);
			expect(node.x()).toBe(0.9);
			expectValid(hash);
		});

		it('removes the element when the new position is invalid', () => {
			const node = hash.insert({x: 1, y: 1, z: 1}) as SpatialElement<Pt>;

			expect(hash.update(node, {x: NaN, y: 0, z: 0})).toBe('invalid_position');
			expect(hash.size()).toBe(0);
			expectValid(hash);
		});

		it('returns null for null or foreign elements', () => {
			const other = new SpatialHash<Pt>(byPoint);
			const node = other.insert({x: 1, y: 1, z: 1}) as SpatialElement<Pt>;

			expect(hash.update(null, {x: 0, y: 0, z: 0})).toBeNull();
			expect(hash.update(node, {x: 0, y: 0, z: 0})).toBeNull();
			expect(node.x()).toBe(1);
		});
	});

	describe('spatial search', () => {
		const bruteRadius = (items: Pt[], point: SpatialPoint, radius: number): number[] =>
			items
				.filter((item) => {
					const dx = item.x - point.x;
					const dy = item.y - point.y;
					const dz = item.z - point.z;
					return dx * dx + dy * dy + dz * dz <= radius * radius;
				})
				.map((item) => item.id!)
				.sort((a, b) => a - b);

		it('withinRadius includes the boundary', () => {
			hash.insertArray([
				{x: 3, y: 4, z: 0, id: 0},
				{x: 3, y: 4, z: 1, id: 1}
			]);

			expect(ids(hash.withinRadius({x: 0, y: 0, z: 0}, 5))).toEqual([0]);
			expect(ids(hash.withinRadius({x: 0, y: 0, z: 0}, 4.99))).toEqual([]);
			expect(ids(hash.withinRadius({x: 3, y: 4, z: 0}, 0))).toEqual([0]);
		});

		it('withinBounds includes faces', () => {
			hash.insertArray([
				{x: 0, y: 0, z: 0, id: 0},
				{x: 10, y: 10, z: 10, id: 1},
				{x: 10.01, y: 5, z: 5, id: 2}
			]);

			const bounds = {minX: 0, minY: 0, minZ: 0, maxX: 10, maxY: 10, maxZ: 10};
			expect(ids(hash.withinBounds(bounds))).toEqual([0, 1]);
		});

		it.each([0.3, 1, 7, 100])('matches brute force at cellSize %p', (cellSize) => {
			const items = randomPoints(400, 11, 60, false);
			const target = new SpatialHash<Pt>(byPoint, items, {cellSize});
			const random = seeded(99);

			for (let i = 0; i < 40; i++) {
				const point = {
					x: (random() * 2 - 1) * 70,
					y: (random() * 2 - 1) * 70,
					z: (random() * 2 - 1) * 70
				};
				const radius = random() * 40;

				expect(ids(target.withinRadius(point, radius))).toEqual(bruteRadius(items, point, radius));

				const bounds = {
					minX: point.x - radius,
					minY: point.y - radius * 0.5,
					minZ: point.z - radius * 2,
					maxX: point.x + radius,
					maxY: point.y + radius,
					maxZ: point.z + radius * 0.25
				};
				const expected = items
					.filter(
						(p) =>
							p.x >= bounds.minX &&
							p.x <= bounds.maxX &&
							p.y >= bounds.minY &&
							p.y <= bounds.maxY &&
							p.z >= bounds.minZ &&
							p.z <= bounds.maxZ
					)
					.map((p) => p.id!)
					.sort((a, b) => a - b);
				expect(ids(target.withinBounds(bounds))).toEqual(expected);

				const nearest = target.nearest(point)!;
				const best = Math.min(...items.map((p) => distance(p, point)));
				expect(distance(nearest.value()!, point)).toBe(best);
			}
		});

		it('searches huge regions by scanning occupied cells', () => {
			const items = randomPoints(50, 12, 1000);
			const target = new SpatialHash<Pt>(byPoint, items, {cellSize: 0.5});
			const all = items.map((p) => p.id!).sort((a, b) => a - b);

			expect(ids(target.withinRadius({x: 0, y: 0, z: 0}, 1e6))).toEqual(all);
			expect(
				ids(
					target.withinBounds({
						minX: -1e300,
						minY: -1e300,
						minZ: -1e300,
						maxX: 1e300,
						maxY: 1e300,
						maxZ: 1e300
					})
				)
			).toEqual(all);
		});

		it('nearest finds items far from every other cell', () => {
			const far = {x: 5000, y: -5000, z: 5000, id: 1};
			hash.insertArray([far, {x: 5001, y: -5000, z: 5000, id: 2}]);

			expect(hash.nearest({x: 0, y: 0, z: 0})!.value()).toBe(far);
		});

		it('nearest returns null when empty or for invalid points', () => {
			expect(hash.nearest({x: 0, y: 0, z: 0})).toBeNull();
			hash.insert({x: 0, y: 0, z: 0});
			expect(hash.nearest({x: NaN, y: 0, z: 0})).toBeNull();
		});

		it.each([
			['radius', (): SpatialElement<Pt>[] => hash.withinRadius({x: 0, y: 0, z: 0}, -1)],
			['radius NaN', (): SpatialElement<Pt>[] => hash.withinRadius({x: 0, y: 0, z: 0}, NaN)],
			['point', (): SpatialElement<Pt>[] => hash.withinRadius({x: NaN, y: 0, z: 0}, 5)],
			[
				'bounds min over max',
				(): SpatialElement<Pt>[] =>
					hash.withinBounds({minX: 1, minY: 0, minZ: 0, maxX: 0, maxY: 1, maxZ: 1})
			],
			['bounds null', (): SpatialElement<Pt>[] => hash.withinBounds(null as any)]
		])('returns nothing for invalid %s', (_label, search) => {
			hash.insert({x: 0, y: 0, z: 0});
			expect(search()).toEqual([]);
		});

		it('refills out arrays', () => {
			hash.insertArray(randomPoints(30, 13, 5));
			const out: SpatialElement<Pt>[] = [null as any, null as any];

			expect(hash.withinRadius({x: 0, y: 0, z: 0}, 100, out)).toBe(out);
			expect(out.length).toBe(30);
			expect(hash.withinBounds({minX: 0, minY: 0, minZ: 0, maxX: 0, maxY: 0, maxZ: 0}, out)).toBe(out);
			expect(out.every((e) => e.x() === 0 && e.y() === 0 && e.z() === 0)).toBe(true);
		});

		it('visitors see the same matches, in the same order, as the array searches', () => {
			hash.insertArray(randomPoints(200, 14, 20));
			const point = {x: 1, y: 2, z: 3};
			const bounds = {minX: -5, minY: -5, minZ: -5, maxX: 5, maxY: 8, maxZ: 5};
			const byRadius: SpatialElement<Pt>[] = [];
			const byBounds: SpatialElement<Pt>[] = [];
			const indexes: number[] = [];

			hash.forEachWithinRadius(point, 9, (element, index, owner) => {
				expect(owner).toBe(hash);
				byRadius.push(element);
				indexes.push(index);
			});
			hash.forEachWithinBounds(bounds, (element) => {
				byBounds.push(element);
			});

			expect(byRadius).toEqual(hash.withinRadius(point, 9));
			expect(byBounds).toEqual(hash.withinBounds(bounds));
			expect(indexes).toEqual(byRadius.map((_e, i) => i));
		});

		it('visitors are safe when func inserts and nests', () => {
			const items = randomPoints(100, 15, 10);
			hash.insertArray(items);
			const visited: Pt[] = [];
			const expected = hash.withinRadius({x: 0, y: 0, z: 0}, 8).map((e) => e.value()!);

			hash.forEachWithinRadius({x: 0, y: 0, z: 0}, 8, (element) => {
				visited.push(element.value()!);
				hash.insert({x: 0, y: 0, z: 0, id: -1});
				hash.forEachWithinBounds({minX: 0, minY: 0, minZ: 0, maxX: 1, maxY: 1, maxZ: 1}, () => {});
			});

			expect(visited).toEqual(expected);
			expectValid(hash);
		});

		it('visitors skip matches removed before they are reached, even when recycled', () => {
			const items = randomPoints(20, 16, 3);
			const nodes = items.map((item) => hash.insert(item) as SpatialElement<Pt>);
			const visited: Pt[] = [];

			hash.forEachWithinRadius({x: 0, y: 0, z: 0}, 100, (element) => {
				visited.push(element.value()!);

				for (const node of nodes) {
					if (node !== element && node._grid) {
						hash.removeNode(node);
						hash.insert({x: 0, y: 0, z: 0, id: -1});
						break;
					}
				}
			});

			expect(visited.every((p) => p.id !== -1)).toBe(true);
			expect(visited.length).toBeLessThan(20);
		});

		it('visitors release their snapshot when func throws', () => {
			hash.insertArray(randomPoints(10, 17, 2));

			expect(() =>
				hash.forEachWithinRadius({x: 0, y: 0, z: 0}, 100, () => {
					throw new Error('stop');
				})
			).toThrow('stop');
			expect((gridOf(hash) as any).eachTop).toBe(0);
			expect((gridOf(hash) as any).eachNodes.every((n: unknown) => n === null)).toBe(true);
		});

		it('visitors pass thisArg', () => {
			hash.insert({x: 0, y: 0, z: 0});
			const context = {};
			let seen: unknown = null;

			hash.forEachWithinBounds(
				{minX: -1, minY: -1, minZ: -1, maxX: 1, maxY: 1, maxZ: 1},
				function (this: unknown) {
					seen = this;
				},
				context
			);
			expect(seen).toBe(context);
		});
	});

	describe('cell table', () => {
		it('grows past expectedCellCount and stays valid', () => {
			const target = new SpatialHash<Pt>(byPoint, null, {expectedCellCount: 1});
			const items = randomPoints(2000, 20, 100);

			target.insertArray(items);

			expect(target.size()).toBe(2000);
			expect((gridOf(target) as any).tableCapacity).toBeGreaterThan(8);
			expectValid(target);
			for (const item of items.slice(0, 50)) {
				expect(target.find(item)).not.toBeNull();
			}
		});

		it('sweeps tombstones under insert and remove churn without growing', () => {
			const target = new SpatialHash<Pt>(byPoint, null, {expectedCellCount: 16});
			const capacity = (gridOf(target) as any).tableCapacity;
			const random = seeded(21);
			const live: SpatialElement<Pt>[] = [];

			for (let i = 0; i < 5000; i++) {
				if (live.length < 8 || random() < 0.5) {
					const coord = (): number => Math.floor(random() * 1e6);
					live.push(
						target.insert({x: coord(), y: coord(), z: coord(), id: i}) as SpatialElement<Pt>
					);
				} else {
					const index = Math.floor(random() * live.length);
					target.removeNode(live[index]);
					live[index] = live[live.length - 1];
					live.pop();
				}

				if (live.length > 12) {
					target.removeNode(live.pop()!);
				}
			}

			expect((gridOf(target) as any).tableCapacity).toBe(capacity);
			expect(target.size()).toBe(live.length);
			expectValid(target);
		});

		it('stays valid under random churn with moves', () => {
			const target = new SpatialHash<Pt>(byPoint, null, {cellSize: 2.5, expectedCellCount: 4});
			const random = seeded(22);
			const live: SpatialElement<Pt>[] = [];

			for (let i = 0; i < 3000; i++) {
				const roll = random();
				const coord = (): number => (random() * 2 - 1) * 40;

				if (roll < 0.45 || live.length === 0) {
					live.push(
						target.insert({x: coord(), y: coord(), z: coord(), id: i}) as SpatialElement<Pt>
					);
				} else if (roll < 0.75) {
					const node = live[Math.floor(random() * live.length)];
					const item = node.value()!;
					item.x = coord();
					item.y += random() - 0.5;
					target.update(node, item);
				} else {
					const index = Math.floor(random() * live.length);
					target.removeNode(live[index]);
					live[index] = live[live.length - 1];
					live.pop();
				}

				if (i % 500 === 0) {
					expectValid(target);
				}
			}

			expectValid(target);
		});
	});

	describe('iteration and traversal', () => {
		it('iterates items in insertion order', () => {
			const items = randomPoints(25, 30);
			hash.insertArray(items);

			expect([...hash]).toEqual(items);
			expect(hash[Symbol.iterator]()).toBeInstanceOf(SpatialIterator);
		});

		it('iterates nothing when empty', () => {
			expect([...hash]).toEqual([]);
		});

		it('iterator reuses one result object', () => {
			hash.insertArray(randomPoints(2, 31));
			const iterator = hash[Symbol.iterator]();

			expect(iterator.next()).toBe(iterator.next());
		});

		it('iterator tolerates removing the item just returned', () => {
			const items = randomPoints(10, 32);
			hash.insertArray(items);
			const seen: Pt[] = [];

			for (const item of hash) {
				seen.push(item!);
				hash.remove(item!);
			}

			expect(seen).toEqual(items);
			expect(hash.size()).toBe(0);
		});

		it('iterator ends when the next element was removed', () => {
			const items = randomPoints(4, 33);
			const nodes = items.map((item) => hash.insert(item) as SpatialElement<Pt>);
			const iterator = hash[Symbol.iterator]();

			expect(iterator.next().value).toBe(items[0]);
			hash.removeNode(nodes[1]);
			expect(iterator.next().done).toBe(true);
			expect(iterator.next().done).toBe(true);
		});

		it('forEach walks a snapshot in insertion order', () => {
			const items = randomPoints(10, 34);
			hash.insertArray(items);
			const seen: Pt[] = [];

			const result = hash.forEach((element, index, owner) => {
				expect(owner).toBe(hash);
				expect(index).toBe(seen.length);
				seen.push(element.value()!);
				hash.insert({x: 0, y: 0, z: 0, id: -1});
			});

			expect(result).toBe(hash);
			expect(seen).toEqual(items);
			expect(hash.size()).toBe(20);
		});

		it('forEach skips elements removed during the walk', () => {
			const items = randomPoints(6, 35);
			const nodes = items.map((item) => hash.insert(item) as SpatialElement<Pt>);
			const seen: Pt[] = [];

			hash.forEach((element) => {
				seen.push(element.value()!);
				if (element === nodes[0]) {
					hash.removeNode(nodes[3]);
				}
			});

			expect(seen).toEqual([items[0], items[1], items[2], items[4], items[5]]);
		});

		it('toArray returns elements in insertion order', () => {
			const items = randomPoints(5, 36);
			const nodes = items.map((item) => hash.insert(item));

			expect(hash.toArray()).toEqual(nodes);
		});
	});

	describe('filter, query, and stringify', () => {
		it('filter builds a new hash with the same locator and options', () => {
			const target = new SpatialHash<Pt>(byPoint, randomPoints(30, 40), {
				cellSize: 4,
				expectedCellCount: 10
			});
			let context: unknown = null;
			const marker = {};
			const result = target.filter(function (this: unknown, element, _index, owner) {
				context = this;
				expect(owner).toBe(target);
				return element.value()!.id! % 2 === 0;
			}, marker);

			expect(context).toBe(marker);
			expect(result).toBeInstanceOf(SpatialHash);
			expect(result).not.toBe(target);
			expect(result.locator).toBe(byPoint);
			expect(result.cellSize).toBe(4);
			expect(result.values()).toEqual(target.values().filter((p) => p.id! % 2 === 0));
			expect(target.size()).toBe(30);
		});

		it('filter keeps pooling options', () => {
			const target = new SpatialHash<Pt>(byPoint, randomPoints(3, 41), {disableElementPooling: true});

			expect(poolOf(target.filter(() => true))).toBeNull();
		});

		it('query finds matches in insertion order and deletes them', () => {
			const items = randomPoints(20, 42);
			hash.insertArray(items);
			const results = hash.query((p) => p.id! >= 15);

			expect(results.map((r) => r.element.value())).toEqual(items.slice(15));
			expect(results[0].key()).toBeNull();
			expect(results[0].index()).toBeNull();
			expect(results[0].delete()).toBe(items[15]);
			expect(results[0].delete()).toBeNull();
			expect(hash.size()).toBe(19);
			expectValid(hash);
		});

		it('query honors limit and filter arrays', () => {
			hash.insertArray(randomPoints(20, 43));

			expect(hash.query(() => true, {limit: 3}).length).toBe(3);
			expect(hash.query([() => true, (p) => p.id === 4]).length).toBe(1);
			expect(hash.query([]).length).toBe(0);
		});

		it('stale query results do not delete a recycled element', () => {
			const a = {x: 1, y: 1, z: 1, id: 1};
			hash.insert(a);
			const [result] = hash.query(() => true);

			hash.remove(a);
			const b = {x: 2, y: 2, z: 2, id: 2};
			const node = hash.insert(b) as SpatialElement<Pt>;

			expect(node).toBe(result.element);
			expect(result.delete()).toBeNull();
			expect(hash.values()).toEqual([b]);
		});

		it('stringify serializes items in insertion order', () => {
			const items = randomPoints(3, 44);
			hash.insertArray(items);

			expect(JSON.parse(hash.stringify()!)).toEqual({type: 'SpatialHash', elements: items});
		});

		it('stringify returns null for items that cannot be serialized', () => {
			const target = new SpatialHash<any>((item) => item.p);
			target.insert({p: {x: 0, y: 0, z: 0}, big: BigInt(1)});

			expect(target.stringify()).toBeNull();
		});
	});

	describe('pooling and reset', () => {
		it('recycles elements on removal', () => {
			const node = hash.insert({x: 1, y: 1, z: 1}) as SpatialElement<Pt>;
			hash.removeNode(node);

			expect(node.value()).toBeNull();
			expect(node._grid).toBeNull();
			expect(hash.insert({x: 2, y: 2, z: 2})).toBe(node);
		});

		it('blanks removed elements when pooling is disabled', () => {
			const target = new SpatialHash<Pt>(byPoint, null, {disableElementPooling: true});
			const node = target.insert({x: 1, y: 1, z: 1}) as SpatialElement<Pt>;

			expect(poolOf(target)).toBeNull();
			target.removeNode(node);
			expect(node.value()).toBeNull();
			expect(node._grid).toBeNull();
			expect(target.insert({x: 2, y: 2, z: 2})).not.toBe(node);
		});

		it('clearElements releases every element and empties the table', () => {
			const nodes = randomPoints(50, 50).map((item) => hash.insert(item) as SpatialElement<Pt>);

			expect(hash.clearElements()).toBe(hash);
			expect(hash.size()).toBe(0);
			expect(hash.cellCount()).toBe(0);
			expect(nodes.every((node) => node._grid === null)).toBe(true);
			expect(poolOf(hash)!.size()).toBe(0);
			expectValid(hash);
		});

		it('reset keeps the locator and options', () => {
			const target = new SpatialHash<Pt>(byPoint, randomPoints(5, 51), {cellSize: 3});

			expect(target.reset()).toBe(target);
			expect(target.size()).toBe(0);
			expect(target.cellSize).toBe(3);
			target.insert({x: 1, y: 1, z: 1});
			expectValid(target);
		});
	});
});
