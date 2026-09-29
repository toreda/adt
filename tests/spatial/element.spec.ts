import {SpatialElement} from '../../src/spatial/element';
import {SpatialHash} from '../../src/spatial/hash';
import {byPoint, type Pt} from './_helpers';

describe('SpatialElement', () => {
	it('starts blank', () => {
		const element = new SpatialElement<Pt>();

		expect(element.value()).toBeNull();
		expect([element.x(), element.y(), element.z()]).toEqual([0, 0, 0]);
		expect([element.cellX(), element.cellY(), element.cellZ()]).toEqual([0, 0, 0]);
		expect(element._slot).toBe(-1);
		expect(element._grid).toBeNull();
	});

	it('takes an initial value', () => {
		const item = {x: 1, y: 2, z: 3};

		expect(new SpatialElement<Pt>(item).value()).toBe(item);
	});

	it('sets any value while unlinked', () => {
		const element = new SpatialElement<Pt>();
		const item = {x: 9, y: 9, z: 9};

		expect(element.value(item)).toBeNull();
		expect(element.value()).toBe(item);
	});

	it('while linked, only accepts a value at exactly its position', () => {
		const hash = new SpatialHash<Pt>(byPoint);
		const item = {x: 1, y: 2, z: 3, id: 1};
		const element = hash.insert(item) as SpatialElement<Pt>;
		const copy = {x: 1, y: 2, z: 3, id: 2};

		element.value({x: 1.5, y: 2, z: 3});
		expect(element.value()).toBe(item);

		element.value(copy);
		expect(element.value()).toBe(copy);
	});

	it('cleanObj clears every field', () => {
		const hash = new SpatialHash<Pt>(byPoint);
		hash.insert({x: 1, y: 1, z: 1});
		const element = hash.insert({x: 1.5, y: -2.5, z: 3}) as SpatialElement<Pt>;
		hash.insert({x: 1.2, y: -2.2, z: 3.2});

		element.cleanObj();

		expect(element).toEqual(new SpatialElement<Pt>());
	});
});
