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

		it('should initialize priority queue with state when passed one', () => {
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
});
