/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import {ADTPriorityQueue} from '../src/priority-queue';

const repeat = (n, f) => {
	while (n-- > 0) f(n);
};

const printHeap = function (obj: ADTPriorityQueue<number>): any {
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
const loadQueue = () => repeat(9, (n) => queue.push(INIT_VALUES[8 - n]));

const comparator = function (a, b) {
	if (typeof b !== 'number') {
		return false;
	}

	if (typeof a !== 'number') {
		return false;
	}

	return a <= b;
};
const queue = new ADTPriorityQueue(comparator);

beforeEach(() => {
	queue.reset();
	expect(queue.size()).toBe(0);
});

describe('INSTANTIATION', () => {
	it('default params', () => {
		const result = new ADTPriorityQueue(comparator);
		expect(result).toBeInstanceOf(ADTPriorityQueue);
		expect(result.size()).toBe(0);
	});

	it('with options', () => {
		const result = new ADTPriorityQueue(comparator, {elements: [1, 2, 3]});
		expect(result).toBeInstanceOf(ADTPriorityQueue);
		expect(result.size()).toBe(3);
	});

	it('stringify queue', () => {
		const stringified = queue.stringify();
		expect(new ADTPriorityQueue(comparator, {serializedState: stringified})).toEqual(queue);
	});

	it('with serialized', () => {
		expect(new ADTPriorityQueue(comparator, {serializedState: ''})).toBeInstanceOf(ADTPriorityQueue);
		const serialized = new ADTPriorityQueue(comparator, {elements: [2, 3, 4]}).stringify();
		const result = new ADTPriorityQueue(comparator, {serializedState: serialized});
		expect(result).toBeInstanceOf(ADTPriorityQueue);
		expect(result.size()).toBe(3);
	});

	it('invalid', () => {
		expect(() => {
			const result = new ADTPriorityQueue(null as any);
			console.log(result);
		}).toThrow();

		expect(() => {
			const result = new ADTPriorityQueue(comparator, {elements: 'adsf' as any});
			console.log(result);
		}).toThrow();

		expect(() => {
			const result = new ADTPriorityQueue(comparator, {serializedState: 'null'});
			console.log(result);
		}).toThrow();

		expect(() => {
			const result = new ADTPriorityQueue(comparator, {serializedState: 'in{valid'});
			console.log(result);
		}).toThrow();

		expect(() => {
			const result = new ADTPriorityQueue(comparator, {serializedState: '{"elements": [4]}'});
			console.log(result);
		}).toThrow();
	});
});

describe('PUSH/POP', () => {
	it('maintain heap', () => {
		expect(queue.peek()).toBeNull();

		([null, 95, 73, 84, null, 62, 40, 51, null, 99] as any).forEach((v, i, a) => {
			const smallestL = a.slice(0, i + 1).sort((a, b) => {
				if (b == null) return a;
				if (a == null) return b;
				return a - b;
			});
			const smallest = smallestL[0];
			queue.push(v);
			expect(queue.peek()).toBe(smallest);
		});

		let gettingBigger = queue.peek();

		while (!queue.isEmpty()) {
			if (queue.peek()) {
				expect(queue.peek()).toBeGreaterThanOrEqual(gettingBigger);
			}
			queue.pop();
			gettingBigger = queue.peek();
		}

		queue.pop();

		[50, null, 99, null].forEach((v) => {
			queue.push(v);
			expect(queue.peek()).toBe(50);
		});

		queue.pop();
	});
});

describe('ARRAY LIKE USAGE', () => {
	beforeEach(loadQueue);

	it('forEach', () => {
		const lowToHigh: any = [];

		queue.forEach((e) => {
			lowToHigh.push(e);
		}, queue);

		lowToHigh.sort((a, b) => a - b);

		lowToHigh.forEach((e) => {
			expect(e).toBe(queue.peek());
			queue.pop();
		});
	});

	it('filter', () => {
		repeat(5, () => queue.push('random string - ' + Math.random().toString()));

		const strings = queue.filter((e) => typeof e === 'string', queue);
		const numbers = queue.filter((e) => typeof e === 'number');

		expect(strings.size()).toBe(5);
		expect(numbers.size()).toBe(9);

		strings.forEach((e) => {
			expect(e).toContain('random string - ');
		});
	});
});

describe('QUERY', () => {
	beforeEach(loadQueue);

	it('array of matches', () => {
		queue.push(null);
		const above = queue.query((value) => (value as number) > 55);
		const below = queue.query((value) => (value as number) < 55);

		expect(above.length + below.length).toBe(queue.size());

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
		queue.push(null);
		const queryLimit = 1;
		const queries = queue.query([(v) => typeof v === 'number', (v) => !!v], {limit: queryLimit});
		const queryLength = queries.length;
		const queueSize = queue.size();
		expect(queries.length).toBe(Math.min(queueSize, queryLimit));

		const queryToDelete = queries[0];
		expect(queryToDelete.key()).toBeNull();
		expect(queryToDelete.index()).not.toBeNull();
		queryToDelete.delete();
		expect(queries.length).toBe(queryLength);
		expect(queue.size()).toBe(queueSize - 1);
		queryToDelete.delete();

		queue.reset();
		queue.push(30);
		queue.query((v) => v === 30)[0].delete();
		expect(queue.size()).toBe(0);
	});
});

// it('huge test', () => {
// 	repeat(99, () => {
// 		repeat(Math.floor(Math.random() * 1000 + 100), () => queue.push(Math.floor(Math.random() * 1000)));

// 		let root = queue.peek();

// 		while (queue.size()) {
// 			expect(root).toBeLessThanOrEqual(queue.peek());
// 			queue.pop();
// 			root = queue.peek();
// 		}
// 	});
// });
