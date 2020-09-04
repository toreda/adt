import { ArmorPriorityQueue } from '../src/priority-queue';

describe('ArmorPriorityQueue', () => {
	let instance: ArmorPriorityQueue<number>;

	beforeAll(() => {
		instance = new ArmorPriorityQueue<number>();
	});

	beforeEach(() => {
		instance.clear();
	});

	describe('constructor', () => {
		it('should initialize empty priority queue', () => {
			const custom = new ArmorPriorityQueue<number>();
			expect(custom.size()).toBe(0);
		});

		it('should initialize priority queue with argument', () => {
			const contents = [
				{rank: 1, data: Math.random()},
				{rank: 9, data: Math.random()},
				{rank: 2, data: Math.random()},
				{rank: 8, data: Math.random()},
				{rank: 3, data: Math.random()},
				{rank: 7, data: Math.random()},
				{rank: 4, data: Math.random()},
				{rank: 6, data: Math.random()},
				{rank: 5, data: Math.random()}
			];
			const expected = contents.slice().sort((a, b) => {
				return a.rank < b.rank ? -1 : +1;
			});
			const custom = new ArmorPriorityQueue<number>(contents);

			for (let i = 0; i < contents.length; i++) {
				const result = custom.pop();
				expect(result).not.toBeNull();
				if (result) expect(result.rank).toBe(expected[i].rank);
			}
		});

		it('should initialize empty priority queue when argument is not an array', () => {
			const custom = new ArmorPriorityQueue<number>(44091 as any);
			expect(custom.size()).toBe(0);
		});
	});

	describe('size', () => {
		it('should return 0 when priority queue is empty', () => {
			expect(instance.size()).toBe(0);
		});

		it('should return 0 if elements are missing', () => {
			delete instance.elements;
			expect(instance.size()).toBe(0);
		});

		it('should return the number of items in priority queue', () => {
			const limit = 5;

			for (let i = 0; i < limit; i++) {
				instance.push({rank: Math.floor(Math.random() * 999), data: Math.floor(Math.random() * 99999)});
			}

			expect(instance.size()).toBe(limit);
		});
	});

	describe('front', () => {
		it('should return null when priority queue size is 0', () => {
			expect(instance.size()).toBe(0);
			expect(instance.front()).toBeNull();
		});

		it('should return the item with the lowest rank in priority queue', () => {
			const items = [
				{rank: 2, data: 95135},
				{rank: 1, data: 75315},
				{rank: 3, data: 45682}
			];
			items.forEach((item) => {
				instance.push(item);
			});
			expect(instance.front()).toStrictEqual(items[1]);
		});
	});

	describe('swapNodes', () => {
		let unchanged: ArmorPriorityQueue<number>;

		beforeAll(() => {
			unchanged = new ArmorPriorityQueue<number>();
		});

		beforeEach(() => {
			unchanged.clear();
		})

		const params = [
			{name: 'null', value: null},
			{name: 'below zero', value: -1},
			{name: 'past end', value: 999},
			{name: 'in array', value: 0},
		];
		const items = [
			{rank: 2, data: 95135},
			{rank: 1, data: 75315},
			{rank: 3, data: 45682}
		];

		params.forEach(param1 => {
			params.forEach(param2 => {
				it(`should do nothing if indexOne is ${param1.name} and indexTwo is ${param2.name}`, () => {
					items.forEach(item => {
						instance.push(item);
						unchanged.push(item);
					});
					instance.swapNodes(param1.value, param2.value)
					expect(instance.elements).toStrictEqual(unchanged.elements);
				});
			});
		});

		it('should swap the order of the items from 1,2,3 to 2,1,3 to 2,3,1', () => {
			items.forEach(item => {
				instance.push(item);
			});
			instance.swapNodes(0, 1);
			expect(instance.elements.map(v => v.rank)).toStrictEqual([2, 1, 3]);
			instance.swapNodes(2, 1);
			expect(instance.elements.map(v => v.rank)).toStrictEqual([2, 3, 1]);
		});

		it('should move all properties of indexOne to indexTwo and vice-versa', () => {
			items.forEach(item => {
				instance.push(item);
				unchanged.push(item);
			})

			instance.swapNodes(0, 1);
			expect(instance.elements[0]).toStrictEqual(unchanged.elements[1]);
			expect(instance.elements[1]).toStrictEqual(unchanged.elements[0]);
			instance.swapNodes(1, 2);
			expect(instance.elements[2]).toStrictEqual(unchanged.elements[0]);
			expect(instance.elements[1]).toStrictEqual(unchanged.elements[2]);
		});

	});

	describe('getParentNodeIndex', () => {
		let items = [
			{rank: 1, data: Math.random()},
			{rank: 2, data: Math.random()},
			{rank: 3, data: Math.random()},
			{rank: 4, data: Math.random()},
			{rank: 5, data: Math.random()},
			{rank: 6, data: Math.random()},
			{rank: 7, data: Math.random()},
			{rank: 8, data: Math.random()},
		];
		it('should return null if null is passed', () => {
			items.forEach(item => {
				instance.push(item);
			});
			expect(instance.getParentNodeIndex(null)).toBeNull();
		});

		it('should return null if 0 or less is passed', () => {
			items.forEach(item => {
				instance.push(item);
			});
			expect(instance.getParentNodeIndex(0)).toBeNull();
			expect(instance.getParentNodeIndex(-1)).toBeNull();
		});

		it('should return null if the index pass is outside the aray', () => {
			items.forEach(item => {
				instance.push(item);
			});
			expect(instance.getParentNodeIndex(99)).toBeNull();
		});

		it('should return null if the result would be outside the array', () => {
			items.forEach(item => {
				instance.push(item);
			});
			expect(instance.getParentNodeIndex(99)).toBeNull();
		});

		it('should return the parent of a valid node if the parent is valid', () => {
			items.forEach(item => {
				instance.push(item);
			});
			expect(instance.getParentNodeIndex(0)).toBeNull();
			expect(instance.getParentNodeIndex(1)).toBe(0);
			expect(instance.getParentNodeIndex(2)).toBe(0);
			expect(instance.getParentNodeIndex(3)).toBe(1);
			expect(instance.getParentNodeIndex(4)).toBe(1);
			expect(instance.getParentNodeIndex(5)).toBe(2);
			expect(instance.getParentNodeIndex(6)).toBe(2);
			expect(instance.getParentNodeIndex(7)).toBe(3);
		});
	});

	describe('getChildNodesIndexes', () => {

	});

	describe('getRankFromIndex', () => {

	});

	describe('push', () => {
		it('should add exactly one item to priority queue when push is called once', () => {
			expect(instance.size()).toBe(0);
			instance.push({rank: 1, data: 45943});
			expect(instance.size()).toBe(1);
		});

		it('should add exactly 15 items to priority queue when push is called 15 times', () => {
			expect(instance.size()).toBe(0);

			const limit = 15;
			for (let i = 0; i < limit; i++) {
				instance.push({rank: Math.floor(Math.random() * 999), data: Math.floor(Math.random() * 99999)});
			}

			expect(instance.size()).toBe(limit);
		});
	});

	describe('pop', () => {
		it('should remove exactly 1 item from the priority queue when pop is called once', () => {
			const limit = 12;
			for (let i = 0; i < limit; i++) {
				instance.push({rank: Math.floor(Math.random() * 999), data: Math.floor(Math.random() * 99999)});
			}
			expect(instance.size()).toBe(limit);
			instance.pop();
			expect(instance.size()).toBe(limit - 1);
		});

		it('should not throw when called on an empty priority queue', () => {
			expect(instance.size()).toBe(0);
			expect(() => {
				instance.pop();
			}).not.toThrow();
		});

		it('should return null when cladded on an empty priority queue', () => {
			expect(instance.size()).toBe(0);
			expect(instance.pop()).toBeNull();
		});

		it('should return first item in priority queue', () => {
			const limit = 15;
			let expectedResult = 99999;

			for (let i = 0; i < limit; i++) {
				let random = Math.floor(Math.random() * 999);
				if (random < expectedResult) expectedResult = random;
				instance.push({rank: random, data: Math.floor(Math.random() * 99999)});
			}

			let result = instance.pop();
			expect(result).not.toBeNull();
			if (result) expect(result.rank).toBe(expectedResult);
		});

		it('should pop items in rank order from priority queue', () => {
			const limit = 15;
			let expectedResults: Array<number> = [];

			for (let i = 0; i < limit; i++) {
				let random = Math.floor(Math.random() * 999);
				expectedResults.push(random);
				instance.push({rank: random, data: Math.floor(Math.random() * 99999)});
			}

			expectedResults.sort((a, b) => a - b);

			for (let i = 0; i < limit; i++) {
				let result = instance.pop();
				expect(result).not.toBeNull();
				if (result) expect(result.rank).toBe(expectedResults[i]);
			}
		});

		it('should return null when called repeatedly on an empty priority queue', () => {
			expect(instance.size()).toBe(0);

			for (let i = 0; i < 5; i++) {
				expect(instance.pop()).toBeNull();
			}
		});
	});

	describe('clear', () => {
		it('should not throw when priority queue is empty', () => {
			expect(instance.size()).toBe(0);
			expect(() => {
				instance.clear();
			}).not.toThrow();
		});

		it('should remove all items from priority queue', () => {
			expect(instance.size()).toBe(0);

			for (let i = 0; i < 5; i++) {
				instance.push({rank: Math.floor(Math.random() * 999), data: Math.floor(Math.random() * 99999)});
			}

			instance.clear();
			expect(instance.size()).toBe(0);
		});
	});
});
