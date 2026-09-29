import type {SpatialElement} from '../../src/spatial/element';
import type {SpatialGrid} from '../../src/spatial/grid';
import type {SpatialPoint} from '../../src/spatial/point';

export interface Pt {
	x: number;
	y: number;
	z: number;
	id?: number;
}

export const byPoint = (item: Pt): SpatialPoint => item;

/** Deterministic pseudo random numbers in [0, 1), so failures reproduce. */
export const seeded = (seed: number): (() => number) => {
	let state = seed;

	return (): number => {
		state = (state * 1664525 + 1013904223) % 4294967296;
		return state / 4294967296;
	};
};

/** Points in [-scale, scale) on each axis. Rounded when round is true, so shared positions show up. */
export const randomPoints = (
	count: number,
	seed: number,
	scale: number = 50,
	round: boolean = true
): Pt[] => {
	const random = seeded(seed);
	const result: Pt[] = [];
	const coord = (): number => {
		const value = (random() * 2 - 1) * scale;
		return round ? Math.round(value) : value;
	};

	for (let i = 0; i < count; i++) {
		result.push({x: coord(), y: coord(), z: coord(), id: i});
	}

	return result;
};

export const distance = (a: SpatialPoint, b: SpatialPoint): number =>
	Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

export const ids = (elements: SpatialElement<Pt>[]): number[] =>
	elements.map((e) => e.value()!.id!).sort((a, b) => a - b);

export const gridOf = <T>(target: object): SpatialGrid<T> => (target as any).grid;

/**
 * Check every structural rule of the grid behind a SpatialHash or SpatialMap:
 * each live table slot heads a non-empty cell list whose elements record that
 * slot and cell, every element's cell matches its position and its locator,
 * cell and insertion order lists link both ways, every cell is reachable by
 * probing, and the size, live cell, and tombstone counts match the table.
 */
export const expectValid = <T>(target: object, maxPerCell: number = Infinity): void => {
	const grid = gridOf<T>(target) as any;
	const state: Uint8Array = grid.tableState;
	let liveCells = 0;
	let tombstones = 0;
	let cellElements = 0;

	for (let slot = 0; slot < grid.tableCapacity; slot++) {
		if (state[slot] === 2) {
			tombstones++;
			expect(grid.tableHead[slot]).toBeNull();
			continue;
		}

		if (state[slot] === 0) {
			expect(grid.tableHead[slot]).toBeNull();
			continue;
		}

		liveCells++;
		const head: SpatialElement<T> | null = grid.tableHead[slot];
		expect(head).not.toBeNull();
		expect(head!._cellPrev).toBeNull();
		expect(grid.findSlot(grid.tableX[slot], grid.tableY[slot], grid.tableZ[slot])).toBe(slot);

		let inCell = 0;

		for (let element = head; element; element = element._cellNext) {
			inCell++;
			cellElements++;
			expect(element._slot).toBe(slot);
			expect(element._grid).toBe(grid);
			expect(element._cellX).toBe(grid.tableX[slot]);
			expect(element._cellY).toBe(grid.tableY[slot]);
			expect(element._cellZ).toBe(grid.tableZ[slot]);

			if (element._cellNext) {
				expect(element._cellNext._cellPrev).toBe(element);
			}
		}

		expect(inCell).toBeLessThanOrEqual(maxPerCell);
	}

	expect(grid.liveCells).toBe(liveCells);
	expect(grid.tombstones).toBe(tombstones);
	expect(liveCells + tombstones).toBeLessThanOrEqual(grid.rebuildThreshold);

	let count = 0;
	let prev: SpatialElement<T> | null = null;

	for (let element: SpatialElement<T> | null = grid._first; element; element = element._next) {
		count++;
		expect(element._prev).toBe(prev);
		expect(element._linkId).toBeGreaterThan(0);
		expect(element._cellX).toBe(grid.cellCoord(element._x));
		expect(element._cellY).toBe(grid.cellCoord(element._y));
		expect(element._cellZ).toBe(grid.cellCoord(element._z));

		const point = grid.locator(element._value as T);
		expect(element._x).toBe(point.x);
		expect(element._y).toBe(point.y);
		expect(element._z).toBe(point.z);
		prev = element;
	}

	expect(grid._last).toBe(prev);
	expect(count).toBe(grid.size());
	expect(cellElements).toBe(count);
};
