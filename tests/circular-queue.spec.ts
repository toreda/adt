import ArmorCircularQueue from '../src/circular-queue';
import ArmorCircularQueueState from '../src/circular-queue-state';

describe('ArmorCircularQueue', () => {
	let instance: ArmorCircularQueue<number>;
	const items = [90, 70, 50, 30, 10, 80, 60, 40, 20];
	const maxSize = 4;

	beforeAll(() => {
		instance = new ArmorCircularQueue<number>(maxSize);
	});

	beforeEach(() => {
		instance.clear();
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
			const types = [-9, -1, 0, 1, 9];
			types.forEach((type) => {
				expect(instance.isInteger(type)).toBe(true);
			});
		});

		it('should return false if n is not an integer', () => {
			const types = [-9.9, -1.5, -0.5, 0.5, 1.5, 9.5, null, undefined];
			types.forEach((type) => {
				expect(instance.isInteger(type!)).toBe(false);
			});
		});
	});

	describe('isStateValid', () => {
		it('should return true if state is a valid ArmorCircularQueueState', () => {
			const custom = new ArmorCircularQueue<number>(maxSize);
			expect(custom.isStateValid()).toBe(true);
		});

		it('should return false if state is null or undefined', () => {
			const custom = new ArmorCircularQueue<number>(maxSize);
			const types = [null, undefined];
			types.forEach((type) => {
				custom.state = type!;
				expect(custom.isStateValid()).toBe(false);
			});
		});

		it('should return false if state.type is not "cqState"', () => {
			const custom = new ArmorCircularQueue<number>(maxSize);
			const types = [null, undefined, ''];
			types.forEach((type) => {
				custom.state.type = type as 'cqState';
				expect(custom.isStateValid()).toBe(false);
			});
		});

		it('should return false if state.size is not an integer >= 0', () => {
			const custom = new ArmorCircularQueue<number>(maxSize);
			const types = [-9, -1.5, -1, 0.5, 10.5, null, undefined];
			types.forEach((type) => {
				custom.state.size = type!;
				expect(custom.isStateValid()).toBe(false);
			});
		});

		it('should return false if state.maxSize is not an integer >= 1', () => {
			const custom = new ArmorCircularQueue<number>(maxSize);
			const types = [-9, -1.5, -1, 0, 0.5, 10.5, null, undefined];
			types.forEach((type) => {
				custom.state.maxSize = type!;
				expect(custom.isStateValid()).toBe(false);
			});
		});

		it('should return false if state.front is not an integer', () => {
			const custom = new ArmorCircularQueue<number>(maxSize);
			const types = [-1.5, 0.5, 7.5, null, undefined];
			types.forEach((type) => {
				custom.state.front = type!;
				expect(custom.isStateValid()).toBe(false);
			});
		});

		it('should return false if state.rear is not an integer', () => {
			const custom = new ArmorCircularQueue<number>(maxSize);
			const types = [-1.5, 0.5, 7.5, null, undefined];
			types.forEach((type) => {
				custom.state.rear = type!;
				expect(custom.isStateValid()).toBe(false);
			});
		});

		it('should return false if state.elements is not an array', () => {
			const custom = new ArmorCircularQueue<number>(maxSize);
			const types = [{}, null, undefined];
			types.forEach((type) => {
				custom.state.elements = type as Array<number>;
				expect(custom.isStateValid()).toBe(false);
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
			const indices = [-1.5, 0.5, 2.5, 99.9, null, undefined];
			indices.forEach((index) => {
				expect(instance.wrapIndex(index as number)).toBe(-1);
			});
		});
	});

	describe('isEmpty', () => {
		it('should return true if state.size === 0', () => {
			instance.state.size = 0;
			expect(instance.isEmpty()).toBe(true);
		});
		it('should return false if state.size is ', () => {
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
	});

	describe('push', () => {
		it('should return false and leave cq alone if cq is full', () => {
			instance.state.elements = [10, 20, 30, 40];
			instance.state.front = 0;
			instance.state.rear = 0;
			instance.state.size = 4;
			const state = instance.stringify();
			expect(instance.isFull()).toBe(true);
			expect(instance.push(50)).toBe(false);
			expect(instance.stringify()).toBe(state);
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

		it('should push 15 items into cq while maintaining a size of 1', () => {
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
	});
	describe('pop', () => {
		it('should run isStateValid check', () => {
			const spy = jest.spyOn(instance, 'isStateValid');

			spy.mockClear();
			instance.pop();
			instance.state.size = 1;
			instance.state.rear = 1;
			instance.state.elements = [10];
			instance.pop();

			expect(spy).toBeCalled();
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

	describe('parse', () => {});
	describe('stringify', () => {});

	describe('parseOptions', () => {});
	describe('parseOptionsState', () => {});

	describe('clear', () => {});
	describe('select', () => {});
});
