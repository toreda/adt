import ArmorCircularQueue from '../src/circular-queue';
import ArmorCircularQueueState from '../src/circular-queue-state';

describe('ArmorCircularQueue', () => {
	let instance: ArmorCircularQueue<number>;
	const items = [90, 70, 50, 30, 10, 80, 60, 40, 20];
	const maxSize = 4;

	const FALSY_INT_VALUES = [null, undefined, ''];
	const FLOAT_VALUES = [-9.9, -0.5, 0.5, 9.9];
	const INVALID_INT_VALUES = ['1.5', '-1', '0', '1', '1.5', NaN];
	const NEG_INT_VALUES = [-1, -10];
	const POS_INT_VALUES = [1, 10];

	beforeAll(() => {
		instance = new ArmorCircularQueue<number>(maxSize);
	});

	beforeEach(() => {
		instance.reset();
	});

	describe('constructor', () => {
		it('should initialize with maxSize if it is an integer > 0', () => {
			const custom1 = new ArmorCircularQueue<number>(1);
			expect(custom1.state.maxSize).toBe(1);
			const custom20 = new ArmorCircularQueue<number>(20);
			expect(custom20.state.maxSize).toBe(20);
		});

		it('should initialize with maxSize of 256 if maxSize is <= 0', () => {
			const custom1 = new ArmorCircularQueue<number>(-1);
			const custom2 = new ArmorCircularQueue<number>(0);
			expect(custom1.state.maxSize).toBe(256);
			expect(custom2.state.maxSize).toBe(256);
		});

		it('should initialize with state when passed one', () => {
			const state: ArmorCircularQueueState<number> = {
				elements: items,
				type: 'cqState',
				maxSize: 9,
				size: 2,
				front: 3,
				rear: 5
			};
			const custom = new ArmorCircularQueue<number>(maxSize, {state: state});

			expect(JSON.parse(custom.stringify()!)).toStrictEqual(state);
		});
	});

	describe('isInteger', () => {
		it('should return true if n is an integer', () => {
			const types: any[] = ([0] as any[]).concat(NEG_INT_VALUES, POS_INT_VALUES);
			types.forEach((type) => {
				expect(instance.isInteger(type)).toBe(true);
			});
		});

		it('should return false if n is not an integer', () => {
			const types: any[] = (FALSY_INT_VALUES as any[]).concat(FLOAT_VALUES, INVALID_INT_VALUES);
			types.forEach((type) => {
				expect(instance.isInteger(type!)).toBe(false);
			});
		});
	});

	describe('isValidState', () => {
		it('should return true if state is a valid ArmorCircularQueueState', () => {
			const custom = new ArmorCircularQueue<number>(maxSize);
			expect(custom.isValidState(custom.state)).toBe(true);
		});

		it('should return false if state is null or undefined', () => {
			const custom = new ArmorCircularQueue<number>(maxSize);
			const types = [null, undefined];
			types.forEach((type) => {
				custom.state = type!;
				expect(custom.isValidState(custom.state)).toBe(false);
			});
		});

		it('should return false if state.type is not "cqState"', () => {
			const custom = new ArmorCircularQueue<number>(maxSize);
			const types = [null, undefined, ''];
			types.forEach((type) => {
				custom.state.type = type as 'cqState';
				expect(custom.isValidState(custom.state)).toBe(false);
			});
		});

		it('should return false if state.size is not an integer >= 0', () => {
			const custom = new ArmorCircularQueue<number>(maxSize);
			const types: any[] = (FALSY_INT_VALUES as any[]).concat(FLOAT_VALUES, INVALID_INT_VALUES, NEG_INT_VALUES);
			types.forEach((type) => {
				custom.state.size = type!;
				expect(custom.isValidState(custom.state)).toBe(false);
			});
		});

		it('should return false if state.maxSize is not an integer >= 1', () => {
			const custom = new ArmorCircularQueue<number>(maxSize);
			const types: any[] = [0 as any].concat(FALSY_INT_VALUES, FLOAT_VALUES, INVALID_INT_VALUES, NEG_INT_VALUES);
			types.forEach((type) => {
				custom.state.maxSize = type!;
				expect(custom.isValidState(custom.state)).toBe(false);
			});
		});

		it('should return false if state.front is not an integer', () => {
			const custom = new ArmorCircularQueue<number>(maxSize);
			const types = (FALSY_INT_VALUES as any[]).concat(FLOAT_VALUES, INVALID_INT_VALUES);
			types.forEach((type) => {
				custom.state.front = type!;
				expect(custom.isValidState(custom.state)).toBe(false);
			});
		});

		it('should return false if state.rear is not an integer', () => {
			const custom = new ArmorCircularQueue<number>(maxSize);
			const types = (FALSY_INT_VALUES as any[]).concat(FLOAT_VALUES, INVALID_INT_VALUES);
			types.forEach((type) => {
				custom.state.rear = type!;
				expect(custom.isValidState(custom.state)).toBe(false);
			});
		});

		it('should return false if state.elements is not an array', () => {
			const custom = new ArmorCircularQueue<number>(maxSize);
			const types = [{}, null, undefined];
			types.forEach((type) => {
				custom.state.elements = type as Array<number>;
				expect(custom.isValidState(custom.state)).toBe(false);
			});
		});
	});

	describe('wrapIndex', () => {
		it('should return a value from 0 to maxSize - 1 when an integer is passed', () => {
			const indices = [-2, -1, 0, 1, maxSize - 1, maxSize, Math.round(maxSize * 3.5)];
			indices.forEach((index) => {
				const res = instance.wrapIndex(index);
				expect(res).toBeGreaterThanOrEqual(0);
				expect(res).toBeLessThan(instance.state.maxSize);
			});
		});

		it('should return -1 if value is not an integer', () => {
			const indices = (FALSY_INT_VALUES as any[]).concat(FLOAT_VALUES, INVALID_INT_VALUES);
			indices.forEach((index) => {
				expect(instance.wrapIndex(index as number)).toBe(-1);
			});
		});
	});

	describe('isEmpty', () => {
		it('should run isValidState check', () => {
			const spy = jest.spyOn(instance, 'isValidState');

			spy.mockClear();
			instance.isEmpty();

			expect(spy).toBeCalled();
		});

		it('should return true if state.size === 0', () => {
			instance.state.size = 0;
			expect(instance.isEmpty()).toBe(true);
		});

		it('should return false if state.size is > 0', () => {
			const sizes = [1, maxSize - 1, maxSize, maxSize * 2];
			sizes.forEach((size) => {
				instance.state.size = size;
				expect(instance.isEmpty()).toBe(false);
			});
		});

		it('should return false if state.size is not an integer >= 0', () => {
			const sizes = [-1, 1.5, 99.9, null, undefined];
			sizes.forEach((size) => {
				instance.state.size = size!;
				expect(instance.isEmpty()).toBe(false);
			});
		});
	});
	describe('isFull', () => {
		it('should run isValidState check', () => {
			const spy = jest.spyOn(instance, 'isValidState');

			spy.mockClear();
			instance.isFull();

			expect(spy).toBeCalled();
		});

		it('should return true if state.size >= maxSize', () => {
			const sizes = [maxSize, maxSize * 2];
			sizes.forEach((size) => {
				instance.state.size = size;
				expect(instance.isFull()).toBe(true);
			});
		});

		it('should return false if 0 <= state.size < maxSize ', () => {
			const sizes = [0, 1, instance.state.maxSize - 1];
			sizes.forEach((size) => {
				instance.state.size = size;
				expect(instance.isFull()).toBe(false);
			});
		});

		it('should return false if state.size is not an integer >= 0', () => {
			const sizes = [-1, 1.5, 99.9, null, undefined];
			sizes.forEach((size) => {
				instance.state.size = size!;
				expect(instance.isFull()).toBe(false);
			});
		});
	});

	describe('front', () => {
		it('should run isValidState check', () => {
			const spy = jest.spyOn(instance, 'isValidState');

			spy.mockClear();
			instance.front();

			expect(spy).toBeCalled();
		});

		it('should return null if state.front is not an integer', () => {
			const indices = [-1.5, 0.5, 1.5, maxSize + 0.5, null, undefined];
			indices.forEach((index) => {
				instance.state.front = index!;
				expect(instance.front()).toBeNull();
			});
		});

		it('should return null if state.size is 0', () => {
			instance.state.size = 0;
			expect(instance.front()).toBeNull();
		});

		it('should return the first element in the CQ', () => {
			instance.push(1);
			instance.push(2);
			expect(instance.front()).toBe(1);
			instance.pop();
			expect(instance.front()).toBe(2);
			instance.push(3);
			instance.push(4);
			instance.push(5);
			expect(instance.front()).toBe(2);
		});

		it('should return a non null value when state.front is < 0 or >= maxSize', () => {
			instance.push(1);
			instance.state.front = -1;
			expect(instance.front()).not.toBeNull();
			instance.state.front = maxSize;
			expect(instance.front()).not.toBeNull();
			instance.state.front = Math.round(maxSize * 2.5);
			expect(instance.front()).not.toBeNull();
		});
	});
	describe('rear', () => {
		it('should run isValidState check', () => {
			const spy = jest.spyOn(instance, 'isValidState');

			spy.mockClear();
			instance.rear();

			expect(spy).toBeCalled();
		});

		it('should return null if state.rear is not an integer', () => {
			const indices = [-1.5, 0.5, 1.5, maxSize + 0.5, null, undefined];
			indices.forEach((index) => {
				instance.state.rear = index!;
				expect(instance.rear()).toBeNull();
			});
		});

		it('should return null if state.size is 0', () => {
			instance.state.size = 0;
			expect(instance.rear()).toBeNull();
		});

		it('should return the last element in the CQ', () => {
			instance.push(1);
			instance.push(2);
			expect(instance.rear()).toBe(2);
			instance.pop();
			expect(instance.rear()).toBe(2);
			instance.push(3);
			instance.push(4);
			instance.push(5);
			expect(instance.rear()).toBe(5);
		});

		it('should return a non null value when state.rear is < 0 or >= maxSize', () => {
			instance.push(1);
			instance.state.rear = -1;
			expect(instance.rear()).not.toBeNull();
			instance.state.rear = maxSize;
			expect(instance.rear()).not.toBeNull();
			instance.state.rear = Math.round(maxSize * 2.5);
			expect(instance.rear()).not.toBeNull();
		});
	});

	describe('getIndex', () => {
		it('should run isValidState check', () => {
			const spy = jest.spyOn(instance, 'isValidState');

			spy.mockClear();
			instance.getIndex(0);

			expect(spy).toBeCalled();
		});

		it('should return null if isValidState returns false', () => {
			instance.state.size = -1;
			expect(instance.getIndex(0)).toBeNull();
		});

		it('should return null if index is not an integer', () => {
			const indices = [-1.5, 0.5, 1.5, maxSize + 0.5, null, undefined];
			indices.forEach((index) => {
				expect(instance.getIndex(index!)).toBeNull();
			});
		});

		it('should return null if state.size is 0', () => {
			instance.state.size = 0;
			expect(instance.getIndex(0)).toBeNull();
		});

		it('should return the first element in the CQ if index is 0', () => {
			instance.push(1);
			instance.push(2);
			expect(instance.getIndex(0)).toBe(1);
			instance.pop();
			expect(instance.getIndex(0)).toBe(2);
			instance.push(3);
			instance.push(4);
			instance.push(5);
			expect(instance.getIndex(0)).toBe(2);
		});

		it('should return the element n indices after front if n is a positive integer', () => {
			instance.state.elements = [-1, -1, -1, -1];
			instance.push(1);
			instance.push(2);
			expect(instance.getIndex(1)).toBe(2);
			expect(instance.getIndex(2)).toBe(-1);
			instance.pop();
			expect(instance.getIndex(1)).toBe(-1);
			expect(instance.getIndex(2)).toBe(-1);
			instance.push(3);
			instance.push(4);
			instance.push(5);
			expect(instance.getIndex(1)).toBe(3);
			expect(instance.getIndex(2)).toBe(4);
			expect(instance.getIndex(3)).toBe(5);
			expect(instance.getIndex(4)).toBe(2);
		});

		it('should return the element n indices after front if n is a negative integer', () => {
			instance.state.elements = [-1, -1, -1, -1];
			instance.push(1);
			instance.push(2);
			// [1,2,-1,-1]
			expect(instance.getIndex(-1)).toBe(1);
			expect(instance.getIndex(-2)).toBe(-1);
			instance.pop();
			// [1,2,-1,-1]
			expect(instance.getIndex(-1)).toBe(1);
			expect(instance.getIndex(-2)).toBe(-1);
			instance.push(3);
			instance.push(4);
			instance.push(5);
			// [5,2,3,4]
			expect(instance.getIndex(-1)).toBe(4);
			expect(instance.getIndex(-2)).toBe(3);
			expect(instance.getIndex(-3)).toBe(2);
			expect(instance.getIndex(-4)).toBe(5);
		});
	});

	describe('push', () => {
		it('should run isValidState check', () => {
			const spy = jest.spyOn(instance, 'isValidState');

			spy.mockClear();
			instance.push(1);

			expect(spy).toBeCalled();
		});

		it('should return false if isValidState returns false', () => {
			instance.state.size = -1;
			expect(instance.push(0)).toBe(false);
		});

		it('should return false and leave cq alone if cq is full and overwrite is false', () => {
			instance.state.elements = [10, 20, 30, 40];
			instance.state.front = 0;
			instance.state.rear = 0;
			instance.state.size = 4;
			const state = instance.stringify();
			expect(instance.isFull()).toBe(true);
			expect(instance.push(50)).toBe(false);
			expect(instance.stringify()).toBe(state);
		});

		it('should return true, overwrite front, and increment if cq is full and overwrite is true', () => {
			instance.overwrite = true;
			instance.state.elements = [10, 20, 30, 40];
			instance.state.front = 0;
			instance.state.rear = 0;
			instance.state.size = 4;
			const state = instance.stringify();
			expect(instance.isFull()).toBe(true);
			expect(instance.push(50)).toBe(true);
			expect(instance.state.elements).toEqual([50, 20, 30, 40]);
			instance.overwrite = false;
		});

		it('should return true and increment rear and size when push is called once', () => {
			expect(instance.state.size).toBe(0);
			expect(instance.state.front).toBe(0);
			expect(instance.state.rear).toBe(0);
			expect(instance.push(10)).toBe(true);
			expect(instance.state.front).toBe(0);
			expect(instance.state.size).toBe(1);
			expect(instance.state.rear).toBe(1);
			expect(instance.state.elements).toStrictEqual([10]);
			instance.push(20);
			instance.push(30);
			instance.push(40);
			instance.pop();
			expect(instance.state.front).toBe(1);
			expect(instance.state.size).toBe(3);
			expect(instance.state.rear).toBe(0);
			expect(instance.state.elements).toStrictEqual([10, 20, 30, 40]);
			expect(instance.push(50)).toBe(true);
			expect(instance.state.front).toBe(1);
			expect(instance.state.size).toBe(4);
			expect(instance.state.rear).toBe(1);
			expect(instance.state.elements).toStrictEqual([50, 20, 30, 40]);
		});

		it('should push 15 items into cq while maintaining a size of 1 if overwrite is false', () => {
			expect(instance.state.size).toBe(0);
			expect(instance.state.elements).toEqual([]);

			const limit = 15;
			for (let i = 0; i < limit; i++) {
				instance.pop();
				expect(instance.state.front).toBe(i % instance.state.maxSize);
				expect(instance.push(i * 10)).toBe(true);
				expect(instance.state.size).toBe(1);
			}

			expect(instance.state.elements).toEqual([120, 130, 140, 110]);
		});

		it('should push 15 items into cq while maintaining a size of 1 if overwrite is true', () => {
			instance.overwrite = true;
			expect(instance.state.size).toBe(0);
			expect(instance.state.elements).toEqual([]);

			const limit = 15;
			for (let i = 0; i < limit; i++) {
				instance.pop();
				expect(instance.state.front).toBe(i % instance.state.maxSize);
				expect(instance.push(i * 10)).toBe(true);
				expect(instance.state.size).toBe(1);
			}

			expect(instance.state.elements).toEqual([120, 130, 140, 110]);
			instance.overwrite = false;
		});

		it('should push items into cq and overwrite front when full', () => {
			instance.overwrite = true;
			expect(instance.state.size).toBe(0);
			expect(instance.state.elements).toEqual([]);

			const limit = 15;
			const expected = [0, 0, 0, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3];
			for (let i = 0; i < limit; i++) {
				expect(instance.push(i * 10)).toBe(true);
				expect(instance.state.front).toBe(expected[i]);
			}

			expect(instance.state.elements).toEqual([120, 130, 140, 110]);
			instance.overwrite = false;
		});
	});
	describe('pop', () => {
		it('should run isValidState check', () => {
			const spy = jest.spyOn(instance, 'isValidState');

			spy.mockClear();
			instance.pop();
			instance.state.size = 1;
			instance.state.rear = 1;
			instance.state.elements = [10];
			instance.pop();

			expect(spy).toBeCalled();
		});

		it('should return null if isValidState returns false', () => {
			instance.state.size = -1;
			expect(instance.pop()).toBeNull();
		});

		it('should return null when cq is empty', () => {
			expect(instance.state.size).toBe(0);
			expect(instance.pop()).toBeNull();
			expect(instance.pop()).toBeNull();
			instance.push(1);
			expect(instance.pop()).not.toBeNull();
			expect(instance.pop()).toBeNull();
			expect(instance.pop()).toBeNull();
		});

		it('should return front element and shrink cq by 1', () => {
			instance.push(10);
			instance.push(20);
			instance.push(30);

			expect(instance.state.size).toBe(3);
			expect(instance.state.front).toBe(0);
			expect(instance.pop()).toBe(instance.state.elements[0]);
			expect(instance.state.size).toBe(2);
			expect(instance.state.front).toBe(1);
		});

		it('should return elements until cq is empty and then return null', () => {
			const custom = new ArmorCircularQueue<number>(10);
			for (let i = 0; i < custom.state.maxSize; i++) {
				custom.push(i + 1);
			}

			for (let i = 0; i < custom.state.maxSize; i++) {
				expect(custom.pop()).toBe(i + 1);
				expect(custom.state.size).toBe(10 - i - 1);
			}
			expect(custom.state.size).toBe(0);
			expect(custom.pop()).toBeNull();
		});
	});

	describe('parse', () => {
		it('should return null if argument is not a string with length > 0', () => {
			expect(instance.parse(4 as any)).toBeNull();
			expect(instance.parse([] as any)).toBeNull();
			expect(instance.parse({} as any)).toBeNull();
			expect(instance.parse('' as any)).toBeNull();
			expect(instance.parse(false as any)).toBeNull();
		});

		it('should return null if string cant be parsed', () => {
			expect(instance.parse('[4,3,')).toBeNull();
			expect(instance.parse('{left:f,right:')).toBeNull();
		});

		it('should return null when a parsable string does not parse into an ArmorCircularQueueState', () => {
			expect(instance.parse('{elements:[], type: "pqState"}')).toBeNull();
			expect(instance.parse('{}')).toBeNull();
			expect(instance.parse('[1,2,3]')).toBeNull();
		});

		it('should return an ArmorCircularQueueState when a parsable string is passed', () => {
			const string = instance.stringify();
			expect(string).not.toBeNull();
			expect(instance.parse(string as string)).toStrictEqual(instance.state);
			expect(
				instance.parse('{"elements": [], "front": 0, "maxSize": 4, "rear": 0, "size": 0, "type": "cqState"}')
			).toStrictEqual(instance.state);
		});
	});
	describe('stringify', () => {
		it('should run isValidState check', () => {
			const spy = jest.spyOn(instance, 'isValidState');

			spy.mockClear();
			instance.stringify();

			expect(spy).toBeCalled();
		});

		it('should return null if state is invalid', () => {
			const custom = new ArmorCircularQueue<number>(10);
			custom.state.maxSize = 0;
			expect(custom.stringify()).toBeNull();
			custom.state = null!;
			expect(custom.state).toBeNull();
			expect(custom.stringify()).toBeNull();
			custom.state = undefined!;
			expect(custom.state).toBeUndefined();
			expect(custom.stringify()).toBeNull();
		});

		it('should return the state as a string if it is validated', () => {
			const custom = new ArmorCircularQueue<number>(10);
			expect(custom.stringify()).toBe(
				'{"type":"cqState","maxSize":10,"elements":[],"front":0,"rear":0,"size":0}'
			);

			custom.push(1);
			expect(custom.stringify()).toBe(
				'{"type":"cqState","maxSize":10,"elements":[1],"front":0,"rear":1,"size":1}'
			);

			custom.push(2);
			expect(custom.stringify()).toBe(
				'{"type":"cqState","maxSize":10,"elements":[1,2],"front":0,"rear":2,"size":2}'
			);

			custom.pop();
			expect(custom.stringify()).toBe(
				'{"type":"cqState","maxSize":10,"elements":[1,2],"front":1,"rear":2,"size":1}'
			);
		});
	});

	describe('parseOptions', () => {
		it('should return void if options is falsey', () => {
			expect(instance.parseOptions(null!)).toBeFalsy();
			expect(instance.parseOptions(undefined!)).toBeFalsy();
		});

		it('should call parseOptionsState if options has state property', () => {
			const spy = jest.spyOn(instance, 'parseOptionsState');

			try {
				spy.mockClear();
				instance.parseOptions({state: ''});
			} catch (e) {}
			expect(spy).toBeCalled();

			try {
				spy.mockClear();
				instance.parseOptions({state: '{}'});
			} catch (e) {}
			expect(spy).toBeCalled();

			try {
				spy.mockClear();
				instance.parseOptions({state: {} as ArmorCircularQueueState<number>});
			} catch (e) {}
			expect(spy).toBeCalled();

			try {
				spy.mockClear();
				instance.parseOptions({state: null!});
			} catch (e) {}
			expect(spy).toBeCalled();

			try {
				spy.mockClear();
				instance.parseOptions({state: instance.state});
			} catch (e) {}
			expect(spy).toBeCalled();

			try {
				spy.mockClear();
				instance.parseOptions({state: instance.stringify() as string});
			} catch (e) {}
			expect(spy).toBeCalled();
		});
	});
	describe('parseOptionsOverwrite', () => {
		it('should set cq overwrite property', () => {
			expect(instance.overwrite).toBe(false);

			instance.parseOptionsOverwrite(true);
			expect(instance.overwrite).toBe(true);

			instance.parseOptionsOverwrite(false);
			expect(instance.overwrite).toBe(false);

			instance.parseOptionsOverwrite(null!);
			expect(instance.overwrite).toBe(false);

			instance.parseOptionsOverwrite(undefined!);
			expect(instance.overwrite).toBe(false);
		});
	});
	describe('parseOptionsState', () => {
		it('should return void if state is falsey', () => {
			expect(instance.parseOptionsState(null!)).toBeFalsy();
			expect(instance.parseOptionsState(undefined!)).toBeFalsy();
			expect(instance.parseOptionsState('')).toBeFalsy();
		});

		it('should run isValidState check', () => {
			const spy = jest.spyOn(instance, 'isValidState');

			spy.mockClear();
			instance.parseOptionsState(instance.stringify()!);
			expect(spy).toBeCalled();
		});

		it('should not run isValidState check and not throw', () => {
			const spy = jest.spyOn(instance, 'isValidState');

			spy.mockClear();
			expect(() => {
				instance.parseOptionsState(instance.state);
			}).not.toThrow();
			expect(spy).not.toBeCalled();
		});

		it('should throw if state is not valid', () => {
			expect(() => {
				instance.parseOptionsState({} as ArmorCircularQueueState<number>);
			}).toThrow();
			expect(() => {
				instance.parseOptionsState('{}');
			}).toThrow();
			const stateString = instance.stringify()!;
			const stateObject = instance.parse(stateString)!;
			stateObject.maxSize = null!;
			expect(() => {
				instance.parseOptionsState(stateString.replace(/elements/, 'elmnts'));
			}).toThrow();
			expect(() => {
				instance.parseOptionsState(stateObject as ArmorCircularQueueState<number>);
			}).toThrow();
		});
	});

	describe('reset', () => {
		const defstate = {
			type: 'cqState',
			front: 0,
			rear: 0,
			size: 0,
			elements: [],
			maxSize: maxSize
		};
		it('should not throw when state has errors', () => {
			instance.state.size = 0.5;
			instance.state.front = 99;
			instance.state.rear = undefined!;
			instance.state.elements = [];
			expect(() => {
				instance.reset();
			}).not.toThrow();
		});

		it('should remove all data from cq when size is 1', () => {
			expect(instance.state.size).toBe(0);

			instance.push(Math.floor(Math.random() * 999));
			expect(instance.state.size).toBe(1);
			instance.reset();
			expect(instance.state).toStrictEqual(defstate);

			instance.push(Math.floor(Math.random() * 999));
			instance.push(Math.floor(Math.random() * 999));
			instance.pop();
			expect(instance.state.size).toBe(1);
			instance.reset();
			expect(instance.state).toStrictEqual(defstate);
		});

		it('should remove all data from cq', () => {
			expect(instance.state.size).toBe(0);

			instance.push(Math.floor(Math.random() * 999));
			instance.push(Math.floor(Math.random() * 999));
			instance.push(Math.floor(Math.random() * 999));
			instance.push(Math.floor(Math.random() * 999));
			expect(instance.state.size).toBe(4);
			instance.reset();
			expect(instance.state).toStrictEqual(defstate);

			instance.push(Math.floor(Math.random() * 999));
			instance.push(Math.floor(Math.random() * 999));
			instance.push(Math.floor(Math.random() * 999));
			instance.push(Math.floor(Math.random() * 999));
			instance.pop();
			expect(instance.state.size).toBe(3);
			instance.reset();
			expect(instance.state).toStrictEqual(defstate);

			instance.push(Math.floor(Math.random() * 999));
			instance.push(Math.floor(Math.random() * 999));
			instance.push(Math.floor(Math.random() * 999));
			instance.push(Math.floor(Math.random() * 999));
			instance.pop();
			instance.pop();
			instance.push(Math.floor(Math.random() * 999));
			instance.push(Math.floor(Math.random() * 999));
			instance.push(Math.floor(Math.random() * 999));
			instance.push(Math.floor(Math.random() * 999));
			expect(instance.state.size).toBe(4);
			instance.reset();
			expect(instance.state).toStrictEqual(defstate);
		});
	});
	describe('select', () => {});
});
