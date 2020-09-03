import {ArmorPriorityQueue} from '../src/priority-queue';

describe('ArmorPriorityQueue', () => {
	let instance: ArmorPriorityQueue<number>;

	beforeAll(() => {
		instance = new ArmorPriorityQueue<number>();
	});

	beforeEach(() => {
		instance.clear();
	});

	describe('Constructor', () => {
		it('should initialize empty priority queue', () => {
			const custom = new ArmorPriorityQueue<number>();
			expect(custom.size()).toBe(0);
		});

		it('should initialize priority queue with argument', () => {
			const contents = [
				{rank: 1, data: 84513},
				{rank: 3, data: 75648},
				{rank: 2, data: 89745},
				{rank: 5, data: 24567},
				{rank: 4, data: 95425}
			];
			const expected = contents.slice().sort((a, b) => {return a.rank < b.rank ? -1 : +1});
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

	describe('front', () => {
		it('should return null when priority queue is empty', () => {
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
			expect(instance.front()).toBe(items[1]);
		});
	});

	describe('size', () => {
		it('should return 0 when priority queue is empty', () => {
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
