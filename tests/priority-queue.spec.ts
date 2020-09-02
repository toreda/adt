import { ArmorPriorityQueue } from '../src/priority-queue';

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
			const contents = [84513, 75648, 89745, 24567, 95425];
			const expected = [24567, 75648, 89745, 84513, 95425];
			const custom = new ArmorPriorityQueue<number>(contents);

			for (let i = 0; i < contents.length; i++ ){
				const result = custom.pop();
				expect(result).toBe(expected[i]);
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
			instance.push(45943);
			expect(instance.size()).toBe(1);
		});
		
		it('should add exactly 15 items to priority queue when push is called 15 times', () => {
			expect(instance.size()).toBe(0);

			const limit = 15;
			for (let i = 0; i < limit; i++ ) {
				instance.push(Math.floor(Math.random() * 99999));
			}

			expect(instance.size()).toBe(limit);
		});
	});




})