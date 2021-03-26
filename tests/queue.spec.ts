/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import {ADTQueue} from '../src/queue';
import {ADTQueueOptions} from '../src/queue/options';
import {QueueIterator} from '../src/queue/iterator';

const repeat = (n, f) => {
	while (n-- > 0) f(n);
};
const add10Items = () => repeat(10, (n) => queue.push((10 - n) * 10));

const queue = new ADTQueue();

beforeEach(() => {
	queue.reset();
	expect(queue.size()).toBe(0);
});

describe('INSTANTIATION', () => {
	it('default params', () => {
		const result = new ADTQueue();
		expect(result).toBeInstanceOf(ADTQueue);
		expect(result.size()).toBe(0);
	});

	it('with options', () => {
		const options: Required<Omit<ADTQueueOptions<any>, 'serializedState'>> = {
			elements: [1, 2, 3]
		};
		const result = new ADTQueue(options);
		expect(result).toBeInstanceOf(ADTQueue);
		expect(result.size()).toBe(3);
	});

	it('stringify queue', () => {
		const stringified = queue.stringify();
		expect(new ADTQueue({serializedState: stringified})).toEqual(queue);
	});

	it('with serialized', () => {
		expect(new ADTQueue({serializedState: ''})).toBeInstanceOf(ADTQueue);
		const source = new ADTQueue({elements: [2, 3, 4]});
		const serialized = source.stringify();
		const result = new ADTQueue({serializedState: serialized});
		expect(result).toBeInstanceOf(ADTQueue);
		expect(result).toEqual(source);
		expect(result.size()).toBe(3);
	});

	it('invalid', () => {
		expect(() => {
			const result = new ADTQueue({elements: 'adsf' as any});
			console.log(result);
		}).toThrow();

		expect(() => {
			const result = new ADTQueue({serializedState: 'null'});
			console.log(result);
		}).toThrow();

		expect(() => {
			const result = new ADTQueue({serializedState: 'in{valid'});
			console.log(result);
		}).toThrow();

		expect(() => {
			const result = new ADTQueue({serializedState: '{"elements": [4]}'});
			console.log(result);
		}).toThrow();
	});
});

describe('PUSH/POP', () => {
	it('static front, move rear', () => {
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
});

describe('ARRAY LIKE USAGE', () => {
	beforeEach(add10Items);

	it('forEach', () => {
		const frontToBack: any = [];

		queue.forEach((e) => {
			frontToBack.push(e);
		}, queue);

		frontToBack.forEach((e) => {
			expect(e).toBe(queue.peek());
			queue.pop();
		});
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

	it('reverse', () => {
		const reversed: any = [];

		queue.forEach((e) => {
			reversed.unshift(e);
		});

		queue.reverse();

		queue.forEach((e, i) => {
			expect(e).toBe(reversed[i]);
		});

		queue.clearElements();
		queue.push(Math.random());
		const singleItem = queue.peek();
		expect(queue.reverse().peek()).toBe(singleItem);
	});
});

describe('Iterator', () => {
	describe('Iterator for empty queue', () => {
		it('should not throw when calling iter.next', () => {
			const iter = new QueueIterator(queue);
			expect(() => {
				iter.next();
			}).not.toThrow();
		});

		it('should return true for done', () => {
			const iter = new QueueIterator(queue);
			expect(() => {
				const res = iter.next();
				expect(res.done).toBe(true);
			}).not.toThrow();
		});

		it('should return null for value', () => {
			const iter = new QueueIterator(queue);
			expect(() => {
				const res = iter.next();
				expect(res.value).toBe(null);
			}).not.toThrow();
		});
	});
	describe('Iterator on singleton queue', () => {
		it('should not throw when calling iter.next', () => {
			queue.push('string');
			const iter = new QueueIterator(queue);
			let res = iter.next();
			expect(res.value).toBe('string');
			expect(res.done).toBe(false);
			res = iter.next();
			expect(res.value).toBe(null);
			expect(res.done).toBe(true);
		});

		it('should return true for done', () => {
			queue.push('string');
			const iter = new QueueIterator(queue);
			let res = iter.next();
			expect(res.value).toBe('string');
			expect(res.done).toBe(false);
			res = iter.next();
			expect(res.done).toBe(true);
		});

		it('should return null for value', () => {
			queue.push('string');
			const iter = new QueueIterator(queue);
			let res = iter.next();
			expect(res.value).toBe('string');
			expect(res.done).toBe(false);
			res = iter.next();
			expect(res.value).toBe(null);
		});
	});
	describe('Iterator on queue', () => {
		it('should not throw when using iterator', () => {
			add10Items();
			queue.push(110);
			const arr: any = [];
			expect(() => {
				for (const item of queue) {
					arr.push(item);
				}
			}).not.toThrow();
			expect(arr.length).toBe(11);
			expect(arr[0]).toBe(10);
			expect(arr[11]).toBe(110);
		});

		it('should return value', () => {
			add10Items();
			queue.push(110);
			const arr: any = [];
			expect(() => {
				for (const item of queue) {
					arr.push(item);
				}
			}).not.toThrow();
			expect(arr.length).toBe(11);
			expect(arr[0]).toBe(10);
			expect(arr[11]).toBe(110);
		});
	});
});

describe('QUERY', () => {
	beforeEach(add10Items);

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
	});
});
