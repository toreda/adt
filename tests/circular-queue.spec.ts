/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import {CircularQueue} from '../src/circular/queue';
import {CircularQueueOptions} from '../src/circular/queue/options';
import {CircularQueueIterator} from '../src/circular/queue/iterator';

const repeat = (n, f) => {
	while (n-- > 0) f(n);
};
const add10ItemsQueue = () => repeat(10, (n) => queue.push((10 - n) * 10));
const add10ItemsCirc = () => repeat(10, (n) => circ.push(10 - n));

const queue = new CircularQueue({maxSize: 15});

const optionsCirc = {maxSize: 7, overwrite: true};
const circ = new CircularQueue(optionsCirc);

beforeEach(() => {
	queue.reset();
	expect(queue.size()).toBe(0);

	circ.reset();
	expect(circ.size()).toBe(0);
});

describe('INSTANTIATION', () => {
	it('default params', () => {
		const result = new CircularQueue();
		expect(result).toBeInstanceOf(CircularQueue);
		expect(result.size()).toBe(0);
	});

	it('with options', () => {
		const options: Required<Omit<CircularQueueOptions<any>, 'serializedState'>> = {
			elements: [1, 2, 3, 4, 5, 6, 7],
			front: 5,
			rear: 0,
			size: 2,
			maxSize: 7,
			overwrite: true
		};
		const result = new CircularQueue(options);
		expect(result).toBeInstanceOf(CircularQueue);
		expect(result.size()).toBe(2);
	});

	it('stringify queue', () => {
		const stringified = queue.stringify();
		expect(new CircularQueue({serializedState: stringified})).toEqual(queue);
	});

	it('with serialized', () => {
		expect(new CircularQueue({serializedState: ''})).toBeInstanceOf(CircularQueue);
		const source = new CircularQueue({elements: [2, 3, 4], front: 1, rear: 3});
		const serialized = source.stringify();
		const result = new CircularQueue({serializedState: serialized});
		expect(result).toBeInstanceOf(CircularQueue);
		expect(result).toEqual(source);
		expect(result.size()).toBe(2);
	});

	it('invalid', () => {
		expect(() => {
			const result = new CircularQueue({
				elements: 'adsf' as any,
				front: '7' as any,
				maxSize: -1 as any,
				overwrite: 0 as any,
				rear: 1.5 as any,
				size: '0' as any
			});
			console.log(result);
		}).toThrow();

		expect(() => {
			const result = new CircularQueue({serializedState: 'null'});
			console.log(result);
		}).toThrow();

		expect(() => {
			const result = new CircularQueue({serializedState: 'in{valid'});
			console.log(result);
		}).toThrow();

		expect(() => {
			const result = new CircularQueue({serializedState: '{"elements": [4]}'});
			console.log(result);
		}).toThrow();
	});
});

describe('PUSH/POP', () => {
	it('move front & rear', () => {
		expect(queue.front()).toBeNull();
		expect(queue.rear()).toBeNull();

		let front = 99;
		queue.push(front);
		expect(queue.front()).toBe(front);

		[13, 24, 35, 46, 57, 68].forEach((v) => {
			queue.push(v);
			expect(queue.rear()).toBe(v);
			expect(queue.front()).toBe(front);
		});

		const rear = queue.rear();
		const initialFront = front;

		while (queue.size()) {
			expect(queue.rear()).toBe(rear);
			expect(queue.front()).toBe(front);
			queue.pop();
			front = queue.front() as number;
			expect(front).not.toBe(initialFront);
		}

		queue.pop();
	});

	it('blocks push when full', () => {
		while (!queue.isFull()) {
			queue.push(Math.random());
		}

		const justFilled = queue.stringify();

		repeat(5, () => {
			expect(queue.push(Math.random())).toBe(false);
			const afterFull = queue.stringify();
			expect(afterFull).toEqual(justFilled);
		});
	});

	it('can override front', () => {
		add10ItemsCirc();

		const size = optionsCirc.maxSize;
		let curr = 10;

		expect(circ.size()).toBe(size);
		expect(circ.front()).toBe(curr - size + 1);
		expect(circ.rear()).toBe(curr);

		repeat(5, () => {
			circ.push(++curr);
			expect(circ.front()).toBe(curr - size + 1);
			expect(circ.rear()).toBe(curr);
		});
	});
});

describe('ARRAY LIKE USAGE', () => {
	beforeEach(add10ItemsQueue);

	it('forEach', () => {
		const frontToBack: any = [];

		queue.forEach((e) => {
			frontToBack.push(e);
		}, queue);

		frontToBack.forEach((e) => {
			expect(e).toBe(queue.peek());
			queue.pop();
		});

		add10ItemsQueue();

		const nonZeroStart: any = [];

		queue.forEach((e) => {
			nonZeroStart.push(e);
		}, queue);

		nonZeroStart.forEach((e) => {
			expect(e).toBe(queue.peek());
			queue.pop();
		});
	});

	it('get relative index', () => {
		expect(circ.getIndex(6)).toBe(null);

		add10ItemsCirc();

		const asArray: any = [];
		const reverse: any = [];

		circ.forEach((e) => {
			asArray.push(e);
			reverse.unshift(e);
		});

		repeat(optionsCirc.maxSize, (n) => {
			expect(circ.getIndex(n)).toBe(asArray[n]);
			expect(circ.getIndex(n - optionsCirc.maxSize)).toBe(reverse[optionsCirc.maxSize - n - 1]);
		});

		expect(circ.getIndex(1.6)).toBe(null);
	});

	it('filter', () => {
		repeat(5, () => queue.push('random string - ' + Math.random().toString()));

		const strings = queue.filter((e) => typeof e === 'string', queue);
		const numbers = queue.filter((e) => typeof e === 'number');

		expect(strings.size()).toBe(5);
		expect(numbers.size()).toBe(10);

		strings.forEach((e) => {
			expect(e).toContain('random string - ');
		});
	});
});

describe('Iterator', () => {
	describe('iterator on empty Cirqular queue', () => {
		it('should not throw on empty cirqular queue', () => {
			const iter = new CircularQueueIterator(circ);
			expect(() => {
				iter.next();
			}).not.toThrow();
		});

		it('should return true for done', () => {
			const iter = new CircularQueueIterator(circ);
			expect(() => {
				const res = iter.next();
				expect(res.done).toBe(true);
			});
		});

		it('should return null for value', () => {
			const iter = new CircularQueueIterator(circ);
			expect(() => {
				const res = iter.next();
				expect(res.value).toBe(null);
			});
		});
	});

	describe('iterator on single element Cirqular queue', () => {
		it('should not throw calling iter.next', () => {
			circ.push(10);
			const iter = new CircularQueueIterator(circ);
			expect(() => {
				let res = iter.next();
				res = iter.next();
			}).not.toThrow();
		});

		it('should return true for done', () => {
			circ.push(10);
			const iter = new CircularQueueIterator(circ);
			expect(() => {
				let res = iter.next();
				res = iter.next();
				expect(res.done).toBe(true);
			});
		});

		it('should return null for value', () => {
			circ.push(10);
			const iter = new CircularQueueIterator(circ);
			expect(() => {
				let res = iter.next();
				res = iter.next();
				expect(res.value).toBe(null);
			});
		});
	});

	describe('iterator for elements of circular queue', () => {
		beforeEach(add10ItemsCirc);
		it('should not throw when using for of', () => {
			const arr: any = [];
			expect(() => {
				for (const item of circ) {
					arr.push(item);
				}
			}).not.toThrow();
		});

		it('should not throw when adding to the cq using for of', () => {
			circ.push(11);
			const arr: any = [];
			expect(() => {
				for (const item of circ) {
					arr.push(item);
				}
			}).not.toThrow();
			expect(arr.length).toBe(circ.size());
			expect(arr[0]).toBe(circ.front());
			expect(arr[circ.size() - 1]).toBe(circ.rear());
		});
	});
});

describe('QUERY', () => {
	beforeEach(add10ItemsQueue);

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

		add10ItemsCirc();
		const circQueries = circ.query((v) => v === 9);
		const circQuery = circQueries[0];
		circQuery.delete();
		expect(circ.size()).toBe(optionsCirc.maxSize - 1);
	});
});
