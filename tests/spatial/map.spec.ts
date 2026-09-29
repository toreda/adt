import {SpatialElement} from '../../src/spatial/element';
import {SpatialIterator} from '../../src/spatial/iterator';
import {SpatialMap} from '../../src/spatial/map';
import {byPoint, distance, expectValid, gridOf, ids, type Pt, randomPoints, seeded} from './_helpers';

/** One point per integer cell in a cube of side span, starting at origin, shuffled. */
const cellPoints = (span: number, seed: number, origin: number = 0): Pt[] => {
	const random = seeded(seed);
	const result: Pt[] = [];

	for (let x = 0; x < span; x++) {
		for (let y = 0; y < span; y++) {
			for (let z = 0; z < span; z++) {
				result.push({
					x: origin + x + random(),
					y: origin + y + random(),
					z: origin + z + random(),
					id: result.length
				});
			}
		}
	}

	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}

	return result;
};

const map = new SpatialMap<Pt>(byPoint);

describe('SpatialMap', () => {
	beforeEach(() => {
		map.reset();
		expect(map.isEmpty()).toBe(true);
	});

	describe('INSTANTIATION', () => {
		it('with only a locator', () => {
			const result = new SpatialMap<Pt>(byPoint);

			expect(result.size()).toBe(0);
			expect(result.locator).toBe(byPoint);
			expect(result.cellSize).toBe(1);
			expect(result.overwrite).toBe(false);
		});

		it('throws when locator is not a function', () => {
			expect(() => new SpatialMap<Pt>(undefined as any)).toThrow(
				'SpatialMap requires a locator function'
			);
		});

		it('inserts data in array order, skipping items in occupied cells', () => {
			const a = {x: 0.1, y: 0.1, z: 0.1, id: 1};
			const b = {x: 0.9, y: 0.9, z: 0.9, id: 2};
			const c = {x: 1.1, y: 0.1, z: 0.1, id: 3};
			const result = new SpatialMap<Pt>(byPoint, [a, b, c]);

			expect(result.values()).toEqual([a, c]);
			expectValid(result, 1);
		});

		it('with overwrite, later items replace earlier ones in data', () => {
			const a = {x: 0.1, y: 0.1, z: 0.1, id: 1};
			const b = {x: 0.9, y: 0.9, z: 0.9, id: 2};
			const result = new SpatialMap<Pt>(byPoint, [a, b], {overwrite: true});

			expect(result.overwrite).toBe(true);
			expect(result.values()).toEqual([b]);
		});

		it('ignores non-array data', () => {
			expect(new SpatialMap<Pt>(byPoint, 'x' as any).size()).toBe(0);
			map.insertArray(null);
			expect(map.size()).toBe(0);
		});

		it.each([1, 'true', null])('falls back to overwrite false for %p', (overwrite) => {
			expect(new SpatialMap<Pt>(byPoint, null, {overwrite: overwrite as any}).overwrite).toBe(false);
		});
	});

	describe('insert', () => {
		it('refuses an occupied cell with cell_occupied', () => {
			const a = {x: 2.2, y: 3.3, z: 4.4};
			const node = map.insert(a) as SpatialElement<Pt>;

			expect(node).toBeInstanceOf(SpatialElement);
			expect(map.insert({x: 2.9, y: 3.0, z: 4.0})).toBe('cell_occupied');
			expect(map.insert({x: 2.2, y: 3.3, z: 4.4})).toBe('cell_occupied');
			expect(map.size()).toBe(1);
			expect(map.find(a)).toBe(node);
		});

		it('with overwrite, replaces the occupant', () => {
			const target = new SpatialMap<Pt>(byPoint, null, {overwrite: true});
			const a = {x: 0.5, y: 0.5, z: 0.5, id: 1};
			const b = {x: 0.6, y: 0.6, z: 0.6, id: 2};
			const nodeA = target.insert(a) as SpatialElement<Pt>;
			const nodeB = target.insert(b) as SpatialElement<Pt>;

			expect(target.size()).toBe(1);
			expect(target.values()).toEqual([b]);
			expect(nodeB.value()).toBe(b);
			// Pooling recycles the replaced element for the new item.
			expect(nodeA).toBe(nodeB);
			expectValid(target, 1);
		});

		it('refuses invalid positions', () => {
			expect(map.insert({x: NaN, y: 0, z: 0})).toBe('invalid_position');
			expect(map.insert(null as any)).toBe('invalid_position');
			expect(map.size()).toBe(0);
		});

		it('fills adjacent cells, including negative ones', () => {
			const items = cellPoints(6, 1, -3);
			map.insertArray(items);

			expect(map.size()).toBe(216);
			expectValid(map, 1);
		});

		it('respects cellSize', () => {
			const target = new SpatialMap<Pt>(byPoint, null, {cellSize: 10});

			expect(target.insert({x: 1, y: 1, z: 1})).toBeInstanceOf(SpatialElement);
			expect(target.insert({x: 9.99, y: 0, z: 5})).toBe('cell_occupied');
			expect(target.insert({x: 10, y: 0, z: 5})).toBeInstanceOf(SpatialElement);
			expect(target.insert({x: -0.01, y: 0, z: 5})).toBeInstanceOf(SpatialElement);
		});
	});

	describe('find and findCell', () => {
		it('finds the item in the cell holding a point', () => {
			const a = {x: 5.25, y: -1.5, z: 0.75};
			const node = map.insert(a) as SpatialElement<Pt>;

			expect(map.find({x: 5.99, y: -1.01, z: 0})).toBe(node);
			expect(map.find({x: 6, y: -1.5, z: 0.75})).toBeNull();
			expect(map.contains({x: 5, y: -2, z: 0})).toBe(true);
			expect(map.contains({x: 5, y: -1, z: 0})).toBe(false);
		});

		it('finds the item by integer cell coordinates', () => {
			const node = map.insert({x: 5.25, y: -1.5, z: 0.75}) as SpatialElement<Pt>;

			expect([node.cellX(), node.cellY(), node.cellZ()]).toEqual([5, -2, 0]);
			expect(map.findCell(5, -2, 0)).toBe(node);
			expect(map.containsCell(5, -2, 0)).toBe(true);
			expect(map.findCell(5, -2, 1)).toBeNull();
			expect(map.containsCell(4, -2, 0)).toBe(false);
		});

		it('findCell returns null for non-integer coordinates', () => {
			map.insert({x: 0, y: 0, z: 0});

			expect(map.findCell(0.5, 0, 0)).toBeNull();
			expect(map.findCell(NaN, 0, 0)).toBeNull();
			expect(map.findCell(0, '0' as any, 0)).toBeNull();
			expect(map.findCell(0, 0, 0)).not.toBeNull();
		});

		it('findCell supports neighbor walks in a voxel grid', () => {
			const items = cellPoints(4, 2);
			map.insertArray(items);
			const center = map.findCell(1, 1, 1)!;
			let neighbors = 0;

			for (let dx = -1; dx <= 1; dx++) {
				for (let dy = -1; dy <= 1; dy++) {
					for (let dz = -1; dz <= 1; dz++) {
						if (
							(dx || dy || dz) &&
							map.containsCell(center.cellX() + dx, center.cellY() + dy, center.cellZ() + dz)
						) {
							neighbors++;
						}
					}
				}
			}

			expect(neighbors).toBe(26);
		});

		it('find returns null for invalid points', () => {
			expect(map.find(undefined as any)).toBeNull();
			expect(map.find({x: 0, y: Infinity, z: 0})).toBeNull();
		});
	});

	describe('remove and removeNode', () => {
		it('removes an item by identity', () => {
			const a = {x: 1, y: 1, z: 1};
			map.insert(a);

			expect(map.remove({x: 1, y: 1, z: 1})).toBeNull();
			expect(map.remove(a)).toBe(a);
			expect(map.remove(a)).toBeNull();
			expect(map.contains(a)).toBe(false);
			expectValid(map, 1);
		});

		it('remove returns null for invalid positions and empty cells', () => {
			expect(map.remove({x: NaN, y: 0, z: 0})).toBeNull();
			expect(map.remove({x: 0, y: 0, z: 0})).toBeNull();
		});

		it('removeNode frees the cell', () => {
			const node = map.insert({x: 1, y: 1, z: 1}) as SpatialElement<Pt>;

			expect(map.removeNode(node)).toEqual({x: 1, y: 1, z: 1});
			expect(map.removeNode(node)).toBeNull();
			expect(map.removeNode(null)).toBeNull();
			expect(map.insert({x: 1.5, y: 1.5, z: 1.5})).toBeInstanceOf(SpatialElement);
		});
	});

	describe('update', () => {
		it('moves an element into an empty cell', () => {
			const item = {x: 0.5, y: 0.5, z: 0.5};
			const node = map.insert(item) as SpatialElement<Pt>;
			item.x = 3.5;

			expect(map.update(node, item)).toBe(node);
			expect(map.findCell(3, 0, 0)).toBe(node);
			expect(map.findCell(0, 0, 0)).toBeNull();
			expectValid(map, 1);
		});

		it('moves within its own cell', () => {
			const item = {x: 0.1, y: 0.1, z: 0.1};
			const node = map.insert(item) as SpatialElement<Pt>;
			item.x = 0.9;

			expect(map.update(node, item)).toBe(node);
			expect(node.x()).toBe(0.9);
			expectValid(map, 1);
		});

		it('refuses a move into an occupied cell and changes nothing', () => {
			const a = {x: 0.5, y: 0.5, z: 0.5, id: 1};
			const b = {x: 1.5, y: 0.5, z: 0.5, id: 2};
			const nodeA = map.insert(a) as SpatialElement<Pt>;
			const nodeB = map.insert(b) as SpatialElement<Pt>;
			const moved = {x: 1.2, y: 0.5, z: 0.5, id: 1};

			expect(map.update(nodeA, moved)).toBe('cell_occupied');
			expect(nodeA.value()).toBe(a);
			expect(nodeA.x()).toBe(0.5);
			expect(map.findCell(1, 0, 0)).toBe(nodeB);
			expect(map.size()).toBe(2);
			expectValid(map, 1);
		});

		it('with overwrite, a move replaces the occupant', () => {
			const target = new SpatialMap<Pt>(byPoint, null, {overwrite: true});
			const a = {x: 0.5, y: 0.5, z: 0.5, id: 1};
			const b = {x: 1.5, y: 0.5, z: 0.5, id: 2};
			const nodeA = target.insert(a) as SpatialElement<Pt>;
			target.insert(b);
			a.x = 1.2;

			expect(target.update(nodeA, a)).toBe(nodeA);
			expect(target.values()).toEqual([a]);
			expect(target.findCell(1, 0, 0)).toBe(nodeA);
			expectValid(target, 1);
		});

		it('removes the element when the new position is invalid', () => {
			const node = map.insert({x: 0, y: 0, z: 0}) as SpatialElement<Pt>;

			expect(map.update(node, {x: 0, y: NaN, z: 0})).toBe('invalid_position');
			expect(map.size()).toBe(0);
		});

		it('returns null for null or foreign elements', () => {
			const other = new SpatialMap<Pt>(byPoint);
			const node = other.insert({x: 0, y: 0, z: 0}) as SpatialElement<Pt>;

			expect(map.update(null, {x: 0, y: 0, z: 0})).toBeNull();
			expect(map.update(node, {x: 5, y: 0, z: 0})).toBeNull();
		});

		it('stays valid under random moves with collisions', () => {
			const random = seeded(3);
			const nodes = cellPoints(5, 3).map((item) => map.insert(item) as SpatialElement<Pt>);
			let refused = 0;

			for (let i = 0; i < 2000; i++) {
				const node = nodes[Math.floor(random() * nodes.length)];
				const moved = {...node.value()!, x: random() * 6, y: random() * 6, z: random() * 6};
				const result = map.update(node, moved);

				if (result === 'cell_occupied') {
					refused++;
				} else {
					expect(result).toBe(node);
				}
			}

			expect(refused).toBeGreaterThan(0);
			expect(map.size()).toBe(125);
			expectValid(map, 1);
		});
	});

	describe('spatial search', () => {
		it('matches brute force for radius, bounds, and nearest', () => {
			const items = cellPoints(10, 4, -5);
			const target = new SpatialMap<Pt>(byPoint, items, {cellSize: 1});
			const random = seeded(5);

			for (let i = 0; i < 30; i++) {
				const point = {
					x: (random() * 2 - 1) * 8,
					y: (random() * 2 - 1) * 8,
					z: (random() * 2 - 1) * 8
				};
				const radius = random() * 5;
				const expected = items
					.filter((p) => distance(p, point) <= radius)
					.map((p) => p.id!)
					.sort((a, b) => a - b);

				expect(ids(target.withinRadius(point, radius))).toEqual(expected);

				const bounds = {
					minX: point.x - radius,
					minY: point.y - radius,
					minZ: point.z - radius,
					maxX: point.x + radius,
					maxY: point.y + radius,
					maxZ: point.z + radius
				};
				const inBounds = items
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
				expect(ids(target.withinBounds(bounds))).toEqual(inBounds);

				const best = Math.min(...items.map((p) => distance(p, point)));
				expect(distance(target.nearest(point)!.value()!, point)).toBe(best);
			}
		});

		it('visitors pass the map and match the array searches', () => {
			map.insertArray(cellPoints(5, 6));
			const point = {x: 2, y: 2, z: 2};
			const seen: SpatialElement<Pt>[] = [];

			const result = map.forEachWithinRadius(point, 2, (element, _index, owner) => {
				expect(owner).toBe(map);
				seen.push(element);
			});
			expect(result).toBe(map);
			expect(seen).toEqual(map.withinRadius(point, 2));

			seen.length = 0;
			const bounds = {minX: 1, minY: 1, minZ: 1, maxX: 3, maxY: 3, maxZ: 3};
			expect(map.forEachWithinBounds(bounds, (element) => seen.push(element))).toBe(map);
			expect(seen).toEqual(map.withinBounds(bounds));

			const out: SpatialElement<Pt>[] = [];
			expect(map.withinBounds(bounds, out)).toBe(out);
			expect(out).toEqual(seen);
			expect(map.withinRadius(point, 2, out)).toBe(out);
			expect(out).toEqual(map.withinRadius(point, 2));
		});
	});

	describe('iteration, filter, query, and stringify', () => {
		it('iterates and walks in insertion order', () => {
			const items = cellPoints(3, 7);
			map.insertArray(items);
			const walked: Pt[] = [];

			expect(map[Symbol.iterator]()).toBeInstanceOf(SpatialIterator);
			expect([...map]).toEqual(items);
			expect(map.values()).toEqual(items);
			expect(map.toArray().map((e) => e.value())).toEqual(items);
			expect(map.forEach((element) => walked.push(element.value()!))).toBe(map);
			expect(walked).toEqual(items);
		});

		it('filter builds a new map with the same options', () => {
			const target = new SpatialMap<Pt>(byPoint, cellPoints(3, 8), {cellSize: 1, overwrite: true});
			const result = target.filter((element) => element.value()!.id! < 10);

			expect(result).toBeInstanceOf(SpatialMap);
			expect(result.overwrite).toBe(true);
			expect(result.values()).toEqual(target.values().filter((p) => p.id! < 10));
		});

		it('query finds and deletes matches', () => {
			const items = cellPoints(2, 9);
			map.insertArray(items);
			const results = map.query((p) => p.id === 3);

			expect(results.length).toBe(1);
			expect(results[0].delete()).toBe(items.find((p) => p.id === 3));
			expect(map.size()).toBe(7);
		});

		it('stringify serializes items in insertion order', () => {
			const items = cellPoints(2, 10);
			map.insertArray(items);

			expect(JSON.parse(map.stringify()!)).toEqual({type: 'SpatialMap', elements: items});
		});

		it('stringify returns null for items that cannot be serialized', () => {
			const target = new SpatialMap<any>((item) => item.p);
			target.insert({p: {x: 0, y: 0, z: 0}, big: BigInt(1)});

			expect(target.stringify()).toBeNull();
		});

		it('clearElements empties every cell', () => {
			map.insertArray(cellPoints(4, 11));

			expect(map.clearElements()).toBe(map);
			expect(map.size()).toBe(0);
			expect(map.findCell(0, 0, 0)).toBeNull();
			expect((gridOf(map) as any).liveCells).toBe(0);
			expectValid(map, 1);
		});

		it('grows its table and stays valid', () => {
			const target = new SpatialMap<Pt>(byPoint, null, {expectedCellCount: 2});
			target.insertArray(cellPoints(12, 12));

			expect(target.size()).toBe(1728);
			expectValid(target, 1);
		});

		it('handles random points, one per cell at most', () => {
			const target = new SpatialMap<Pt>(byPoint, randomPoints(500, 13, 10, false), {cellSize: 2});

			expect(target.size()).toBeLessThanOrEqual(500);
			expect(target.size()).toBe((gridOf(target) as any).liveCells);
			expectValid(target, 1);
		});
	});
});
