import {CircularQueue} from '../../src/circular/queue';
import {CircularQueueIterator} from '../../src/circular/queue/iterator';
import {type CircularQueueOptions} from '../../src/circular/queue/options';

const QUEUE_MAX_SIZE = 10;
const repeat = (n: number, f: any) => {
	while (n-- > 0) f(n);
};

const add10ItemsQueue = (q: CircularQueue<any>) => repeat(10, (n: number) => q.push((10 - n) * 10));
const add10ItemsCirc = (q: CircularQueue<any>) => repeat(10, (n: number) => q.push(10 - n));

describe('CircularQueue', () => {
	let instance: CircularQueue<any>;
	let options: CircularQueueOptions<any>;

	beforeAll(() => {
		options = {};
		instance = new CircularQueue({maxSize: 15, overwrite: true});
	});

	beforeEach(() => {
		instance.reset();
		expect(instance.size()).toBe(0);
		options = {
			maxSize: 7
		};

		instance.reset();
		expect(instance.size()).toBe(0);
	});

	describe('INSTANTIATION', () => {
		it('default params', () => {
			const result = new CircularQueue();
			expect(result).toBeInstanceOf(CircularQueue);
			expect(result.size()).toBe(0);
		});

		it('with options', () => {
			const options: CircularQueueOptions<any> = {
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

		it('stringify instance', () => {
			const stringified = instance.stringify();
			expect(new CircularQueue({serializedState: stringified})).toEqual(instance);
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
			expect(instance.front()).toBeNull();
			expect(instance.rear()).toBeNull();

			let front = 99;
			instance.push(front);
			expect(instance.front()).toBe(front);

			[13, 24, 35, 46, 57, 68].forEach((v) => {
				instance.push(v);
				expect(instance.rear()).toBe(v);
				expect(instance.front()).toBe(front);
			});

			const rear = instance.rear();
			const initialFront = front;

			while (instance.size()) {
				expect(instance.rear()).toBe(rear);
				expect(instance.front()).toBe(front);
				instance.pop();
				front = instance.front() as number;
				expect(front).not.toBe(initialFront);
			}

			instance.pop();
		});

		it('blocks push when full', () => {
			const q = new CircularQueue<number>({maxSize: QUEUE_MAX_SIZE, overwrite: false});

			while (!q.isFull()) {
				q.push(Math.random());
			}

			const justFilled = q.stringify();

			repeat(5, () => {
				expect(q.push(Math.random())).toBe(false);
				const afterFull = q.stringify();
				expect(afterFull).toEqual(justFilled);
			});
		});

		it('can override front', () => {
			const q = new CircularQueue<number>({maxSize: QUEUE_MAX_SIZE, overwrite: true});
			add10ItemsCirc(q);

			const size = QUEUE_MAX_SIZE;
			let curr = 10;

			expect(q.size()).toBe(size);
			expect(q.front()).toBe(curr - size + 1);
			expect(q.rear()).toBe(curr);

			repeat(5, () => {
				q.push(++curr);
				expect(q.front()).toBe(curr - size + 1);
				expect(q.rear()).toBe(curr);
			});
		});
	});

	describe('INSERT FRONT', () => {
		it('inserts elements ahead of the current front', () => {
			instance.push(1, 2, 3);
			instance.insertFront(0);

			expect(instance.size()).toBe(4);
			expect(instance.front()).toBe(0);
			expect(instance.rear()).toBe(3);
			expect([...instance]).toEqual([0, 1, 2, 3]);
		});

		it('inserts into an empty queue', () => {
			instance.insertFront('a');
			instance.insertFront('b');

			expect(instance.size()).toBe(2);
			expect(instance.front()).toBe('b');
			expect(instance.rear()).toBe('a');
			expect([...instance]).toEqual(['b', 'a']);
		});

		it('overwrites the rear element when full with overwrite enabled', () => {
			while (!instance.isFull()) {
				instance.push(instance.size());
			}

			const size = instance.size();
			const secondToLast = instance.getIndex(size - 2);

			expect(instance.insertFront(-1)).toBe(true);
			expect(instance.size()).toBe(size);
			expect(instance.front()).toBe(-1);
			expect(instance.rear()).toBe(secondToLast);
		});

		it('returns false when full with overwrite disabled', () => {
			const q = new CircularQueue<number>({maxSize: 3, overwrite: false});
			q.push(1, 2, 3);

			expect(q.insertFront(0)).toBe(false);
			expect(q.size()).toBe(3);
			expect([...q]).toEqual([1, 2, 3]);
		});
	});

	describe('ARRAY LIKE USAGE', () => {
		it('forEach', () => {
			const frontToBack: any = [];

			instance.forEach((e: number) => {
				frontToBack.push(e);
			}, instance);

			frontToBack.forEach((e: any) => {
				expect(e).toBe(instance.peek());
				instance.pop();
			});

			add10ItemsQueue(instance);

			const nonZeroStart: any = [];

			instance.forEach((e: any) => {
				nonZeroStart.push(e);
			}, instance);

			nonZeroStart.forEach((e: any) => {
				expect(e).toBe(instance.peek());
				instance.pop();
			});
		});

		it('get relative index', () => {
			expect(instance.getIndex(6)).toBe(null);

			add10ItemsCirc(instance);

			const asArray: any = [];
			const reverse: any = [];

			instance.forEach((e) => {
				asArray.push(e);
				reverse.unshift(e);
			});

			repeat(QUEUE_MAX_SIZE, (n: number) => {
				expect(instance.getIndex(n)).toBe(asArray[n]);
				expect(instance.getIndex(n - QUEUE_MAX_SIZE)).toBe(reverse[QUEUE_MAX_SIZE - n - 1]);
			});

			expect(instance.getIndex(1.6)).toBe(null);
		});

		it('filter', () => {
			add10ItemsQueue(instance);
			repeat(5, () => instance.push('random string - ' + Math.random().toString()));

			const strings = instance.filter((e) => typeof e === 'string', instance);
			const numbers = instance.filter((e) => typeof e === 'number');

			expect(strings.size()).toBe(5);
			expect(numbers.size()).toBe(10);

			strings.forEach((e) => {
				expect(e).toContain('random string - ');
			});
		});
	});

	describe('Iterator', () => {
		describe('iterator on empty Cirqular instance', () => {
			it('should not throw on empty cirqular instance', () => {
				const iter = new CircularQueueIterator(instance);
				expect(() => {
					iter.next();
				}).not.toThrow();
			});

			it('should return true for done', () => {
				const iter = new CircularQueueIterator(instance);
				expect(() => {
					const res = iter.next();
					expect(res.done).toBe(true);
				});
			});

			it('should return null for value', () => {
				const iter = new CircularQueueIterator(instance);
				expect(() => {
					const res = iter.next();
					expect(res.value).toBe(null);
				});
			});
		});

		describe('iterator on single element Cirqular instance', () => {
			it('should not throw calling iter.next', () => {
				instance.push(10);
				const iter = new CircularQueueIterator(instance);
				expect(() => {
					let res = iter.next();
					res = iter.next();
				}).not.toThrow();
			});

			it('should return true for done', () => {
				instance.push(10);
				const iter = new CircularQueueIterator(instance);
				expect(() => {
					let res = iter.next();
					res = iter.next();
					expect(res.done).toBe(true);
				});
			});

			it('should return null for value', () => {
				instance.push(10);
				const iter = new CircularQueueIterator(instance);
				expect(() => {
					let res = iter.next();
					res = iter.next();
					expect(res.value).toBe(null);
				});
			});
		});

		describe('iterator for elements of instanceular instance', () => {
			beforeEach(() => {
				add10ItemsCirc(instance);
			});

			it('should not throw when using for of', () => {
				const arr: any = [];
				expect(() => {
					for (const item of instance) {
						arr.push(item);
					}
				}).not.toThrow();
			});

			it('should not throw when adding to the cq using for of', () => {
				instance.push(11);
				const arr: any = [];
				expect(() => {
					for (const item of instance) {
						arr.push(item);
					}
				}).not.toThrow();
				expect(arr.length).toBe(instance.size());
				expect(arr[0]).toBe(instance.front());
				expect(arr[instance.size() - 1]).toBe(instance.rear());
			});
		});
	});

	describe('QUERY', () => {
		beforeEach(() => {
			add10ItemsQueue(instance);
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

			add10ItemsCirc(instance);
			const sizeBeforeDelete = instance.size();
			const instanceQueries = instance.query((v) => v === 9);
			const instanceQuery = instanceQueries[0];
			instanceQuery.delete();
			expect(instance.size()).toBe(sizeBeforeDelete - 1);
		});

		it('preserves element order when deleting from a wrapped queue', () => {
			const q = new CircularQueue<string>({maxSize: 5, overwrite: false});
			q.push('a', 'b', 'c', 'd', 'e');
			q.pop();
			q.pop();
			q.push('f', 'g');

			// Physical layout is now [f, g, c, d, e] with front at index 2.
			expect([...q]).toEqual(['c', 'd', 'e', 'f', 'g']);

			const match = q.query((v) => v === 'd')[0];
			expect(match.delete()).toBe('d');

			expect(q.size()).toBe(4);
			expect([...q]).toEqual(['c', 'e', 'f', 'g']);
		});

		it('deletes the rear element of a wrapped queue', () => {
			const q = new CircularQueue<string>({maxSize: 5, overwrite: false});
			q.push('a', 'b', 'c', 'd', 'e');
			q.pop();
			q.pop();
			q.push('f', 'g');

			const match = q.query((v) => v === 'g')[0];
			expect(match.delete()).toBe('g');

			expect(q.size()).toBe(4);
			expect([...q]).toEqual(['c', 'd', 'e', 'f']);
		});
	});
});
