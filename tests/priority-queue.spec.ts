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
		it('should initialize empty queue', () => {
			const custom = new ArmorPriorityQueue<number>();
			expect(custom.size()).toBe(0);
		});
		
		it('should initialize priority queue with arguments', () => {
			const contents = [84513, 75648, 89745];
			const custom = new ArmorPriorityQueue<number>(contents);
		});
	});






})