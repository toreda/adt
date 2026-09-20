import {PriorityQueue} from '../../src/priority/queue';
import {type PriorityQueueOptions} from '../../src/priority/queue/options';

const repeat = (n: number, f: Function) => {
	while (n-- > 0) {
		f(n);
	}
};

const printHeap = function (obj: PriorityQueue<number>): any {
	let longest = 0;
	let count = 1;
	obj.forEach((v) => {
		if (v == null) {
			v = 0;
		}
		const size = v.toString().length;
		if (longest < size) longest = size;
	});

	while (count < obj.size()) {
		count *= 2;
	}

	const output: Array<number[]> = [];
	let temp: number[] = [];

	obj.forEach((v, i) => {
		if (Math.log2(i + 1) % 1 == 0) {
			output.push(temp);
			temp = [];
		}
		temp.push(v);
	});
	output.push(temp);

	return output
		.map((v, i) => {
			const total = Math.pow(2, i) * 2 - 1;
			const leftpad = ' '.repeat(longest * Math.pow(2, output.length - i - 1) - longest);
			const midpad = ' '.repeat(longest * Math.pow(2, output.length - i) - longest);
			return leftpad + v.map((vv) => ('0'.repeat(longest) + vv).slice(-1 * longest)).join(midpad);
		})
		.join('\n');
};

const INIT_VALUES = [90, 70, 50, 30, 10, 80, 60, 40, 20];
const loadQueue = (queue: PriorityQueue<any>) => repeat(9, (n: number) => queue.push(INIT_VALUES[8 - n]));

const comparator = function (a: number, b: number) {
	if (typeof b !== 'number') {
		return false;
	}

	if (typeof a !== 'number') {
		return false;
	}

	return a <= b;
};

describe('PriorityQueue', () => {
	let instance: PriorityQueue<any>;

	beforeAll(() => {
		instance = new PriorityQueue(comparator);
	});

	beforeEach(() => {
		instance.reset();
		expect(instance.size()).toBe(0);
	});

	describe('INSTANTIATION', () => {
		it('default params', () => {
			const result = new PriorityQueue(comparator);
			expect(result).toBeInstanceOf(PriorityQueue);
			expect(result.size()).toBe(0);
		});

		it('with options', () => {
			const options: Required<Omit<PriorityQueueOptions<any>, 'serializedState'>> = {
				elements: [1, 2, 3]
			};
			const result = new PriorityQueue(comparator, options);
			expect(result).toBeInstanceOf(PriorityQueue);
			expect(result.size()).toBe(3);
		});

		it('stringify queue', () => {
			const stringified = instance.stringify();
			expect(new PriorityQueue(comparator, {serializedState: stringified})).toEqual(instance);
		});

		it('with serialized', () => {
			expect(new PriorityQueue(comparator, {serializedState: ''})).toBeInstanceOf(PriorityQueue);
			const source = new PriorityQueue(comparator, {elements: [2, 3, 4]});
			const serialized = source.stringify();
			const result = new PriorityQueue(comparator, {serializedState: serialized});
			expect(result).toBeInstanceOf(PriorityQueue);
			expect(result).toEqual(source);
			expect(result.size()).toBe(3);
		});

		it('invalid', () => {
			expect(() => {
				const result = new PriorityQueue(null as any);
				console.log(result);
			}).toThrow();

			expect(() => {
				const result = new PriorityQueue(comparator, {elements: 'adsf' as any});
				console.log(result);
			}).toThrow();

			expect(() => {
				const result = new PriorityQueue(comparator, {serializedState: 'null'});
				console.log(result);
			}).toThrow();

			expect(() => {
				const result = new PriorityQueue(comparator, {serializedState: 'in{valid'});
				console.log(result);
			}).toThrow();

			expect(() => {
				const result = new PriorityQueue(comparator, {serializedState: '{"elements": [4]}'});
				console.log(result);
			}).toThrow();
		});
	});

	describe('HEAP INVARIANT', () => {
		const drain = (queue: PriorityQueue<number>): number[] => {
			const popped: number[] = [];
			while (!queue.isEmpty()) {
				popped.push(queue.pop() as number);
			}
			return popped;
		};

		it('heapifies small unsorted element sets on construction', () => {
			const result = new PriorityQueue<number>(comparator, {elements: [5, 1, 3]});
			expect(drain(result)).toEqual([1, 3, 5]);
		});

		it('heapifies larger unsorted element sets on construction', () => {
			const elements = [9, 4, 7, 1, 8, 2, 6, 3, 5, 0];
			const result = new PriorityQueue<number>(comparator, {elements});
			expect(drain(result)).toEqual([...elements].sort((a, b) => a - b));
		});

		it('preserves heap order after query delete requiring sift up', () => {
			const elements = [0, 50, 1, 60, 70, 2, 3, 61, 62, 71, 72, 2.5];
			const result = new PriorityQueue<number>(comparator, {elements});
			result.query((n) => n === 60)[0].delete();
			expect(drain(result)).toEqual(elements.filter((n) => n !== 60).sort((a, b) => a - b));
		});

		it('preserves heap order after query delete requiring sift down', () => {
			const elements = [1, 2, 10, 3, 4, 11, 12];
			const result = new PriorityQueue<number>(comparator, {elements});
			result.query((n) => n === 2)[0].delete();
			expect(drain(result)).toEqual(elements.filter((n) => n !== 2).sort((a, b) => a - b));
		});

		it('preserves heap order after query delete of last element and root', () => {
			const result = new PriorityQueue<number>(comparator, {elements: [1, 2, 3]});
			result.query((n) => n === 3)[0].delete();
			result.query((n) => n === 1)[0].delete();
			expect(drain(result)).toEqual([2]);
		});
	});

	describe('PUSH/POP', () => {
		it('maintain heap', () => {
			expect(instance.peek()).toBeNull();

			([null, 95, 73, 84, null, 62, 40, 51, null, 99] as any).forEach((v, i, a) => {
				const smallestL = a.slice(0, i + 1).sort((a, b) => {
					if (b == null) return a;
					if (a == null) return b;
					return a - b;
				});
				const smallest = smallestL[0];
				instance.push(v);
				expect(instance.peek()).toBe(smallest);
			});

			let gettingBigger = instance.peek();

			while (!instance.isEmpty()) {
				if (instance.peek()) {
					expect(instance.peek()).toBeGreaterThanOrEqual(gettingBigger);
				}
				instance.pop();
				gettingBigger = instance.peek();
			}

			instance.pop();

			[50, null, 99, null].forEach((v) => {
				instance.push(v);
				expect(instance.peek()).toBe(50);
			});

			instance.pop();
		});
	});

	describe('ARRAY LIKE USAGE', () => {
		let lowToHigh: number[];

		beforeAll(() => {
			lowToHigh = [];
		});
		beforeEach(() => {
			loadQueue(instance);
		});

		it('forEach', () => {
			instance.forEach((e) => {
				lowToHigh.push(e);
			}, instance);

			lowToHigh.sort((a, b) => a - b);

			lowToHigh.forEach((e) => {
				expect(e).toBe(instance.peek());
				instance.pop();
			});
		});

		it('filter', () => {
			repeat(5, () => instance.push('random string - ' + Math.random().toString()));

			const strings = instance.filter((e) => typeof e === 'string', instance);
			const numbers = instance.filter((e) => typeof e === 'number');

			expect(strings.size()).toBe(5);
			expect(numbers.size()).toBe(9);

			strings.forEach((e) => {
				expect(e).toContain('random string - ');
			});
		});
	});

	describe('QUERY', () => {
		beforeEach(() => {
			loadQueue(instance);
		});

		it('array of matches', () => {
			instance.push(null);
			const above = instance.query((value) => (value as number) > 55);
			const below = instance.query((value) => (value as number) < 55);

			expect(above.length + below.length).toBe(instance.size());

			expect(
				above.every((res) => {
					const value = res.element as number;
					return value > 55;
				})
			).toBe(true);

			expect(
				below.every((res) => {
					const value = res.element as number;
					return value < 55;
				})
			).toBe(true);
		});

		it('using queries', () => {
			instance.push(null);
			const queryLimit = 1;
			const queries = instance.query([(v) => typeof v === 'number', (v) => !!v], {limit: queryLimit});
			const queryLength = queries.length;
			const instanceSize = instance.size();
			expect(queries.length).toBe(Math.min(instanceSize, queryLimit));

			const queryToDelete = queries[0];
			expect(queryToDelete.key()).toBeNull();
			expect(queryToDelete.index()).not.toBeNull();
			queryToDelete.delete();
			expect(queries.length).toBe(queryLength);
			expect(instance.size()).toBe(instanceSize - 1);
			queryToDelete.delete();

			instance.reset();
			instance.push(30);
			instance.query((v) => v === 30)[0].delete();
			expect(instance.size()).toBe(0);
		});
	});
});
