import {Queue} from '../src/queue';
import {QueueIterator} from '../src/queue/iterator';
import {type QueueOptions} from '../src/queue/options';

const repeat = (n: number, f: Function) => {
	while (n-- > 0) {
		f(n);
	}
};
const add10Items = (q: Queue<any>) => repeat(10, (n: number) => q.push((10 - n) * 10));

describe('Queue', () => {
	let instance: Queue<any>;

	beforeAll(() => {
		instance = new Queue<any>();
	});

	beforeEach(() => {
		instance.reset();
		expect(instance.size()).toBe(0);
	});

	describe('INSTANTIATION', () => {
		it('default params', () => {
			const result = new Queue();
			expect(result).toBeInstanceOf(Queue);
			expect(result.size()).toBe(0);
		});

		it('with options', () => {
			const options: Required<Omit<QueueOptions<any>, 'serializedState'>> = {
				elements: [1, 2, 3]
			};
			const result = new Queue(options);
			expect(result).toBeInstanceOf(Queue);
			expect(result.size()).toBe(3);
		});

		it('stringify queue', () => {
			const stringified = instance.stringify();
			expect(new Queue({serializedState: stringified})).toEqual(instance);
		});

		it('with serialized', () => {
			expect(new Queue({serializedState: ''})).toBeInstanceOf(Queue);
			const source = new Queue({elements: [2, 3, 4]});
			const serialized = source.stringify();
			const result = new Queue({serializedState: serialized});
			expect(result).toBeInstanceOf(Queue);
			expect(result).toEqual(source);
			expect(result.size()).toBe(3);
		});

		it('invalid', () => {
			expect(() => {
				const result = new Queue({elements: 'adsf' as any});
				console.log(result);
			}).toThrow();

			expect(() => {
				const result = new Queue({serializedState: 'null'});
				console.log(result);
			}).toThrow();

			expect(() => {
				const result = new Queue({serializedState: 'in{valid'});
				console.log(result);
			}).toThrow();

			expect(() => {
				const result = new Queue({serializedState: '{"elements": [4]}'});
				console.log(result);
			}).toThrow();
		});
	});

	describe('PUSH/POP', () => {
		it('static front, move rear', () => {
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
	});

	describe('ARRAY LIKE USAGE', () => {
		beforeEach(() => {
			add10Items(instance);
		});

		it('forEach', () => {
			const frontToBack: any = [];

			instance.forEach((e) => {
				frontToBack.push(e);
			}, instance);

			frontToBack.forEach((e: number) => {
				expect(e).toBe(instance.peek());
				instance.pop();
			});
		});

		it('filter', () => {
			repeat(5, () => instance.push('random string - ' + Math.random().toString()));

			const strings = instance.filter((e) => typeof e === 'string', instance);
			const numbers = instance.filter((e) => typeof e === 'number');

			expect(strings.size()).toBe(5);
			expect(numbers.size()).toBe(10);

			strings.forEach((e) => {
				expect(e).toContain('random string - ');
			});
		});

		it('reverse', () => {
			const reversed: any = [];

			instance.forEach((e) => {
				reversed.unshift(e);
			});

			instance.reverse();

			instance.forEach((e, i) => {
				expect(e).toBe(reversed[i]);
			});

			instance.clearElements();
			instance.push(Math.random());
			const singleItem = instance.peek();
			expect(instance.reverse().peek()).toBe(singleItem);
		});
	});

	describe('Iterator', () => {
		describe('Iterator for empty queue', () => {
			it('should not throw when calling iter.next', () => {
				const iter = new QueueIterator(instance);
				expect(() => {
					iter.next();
				}).not.toThrow();
			});

			it('should return true for done', () => {
				const iter = new QueueIterator(instance);
				expect(() => {
					const res = iter.next();
					expect(res.done).toBe(true);
				});
			});

			it('should return null for value', () => {
				const iter = new QueueIterator(instance);
				expect(() => {
					const res = iter.next();
					expect(res.value).toBe(null);
				});
			});
		});
		describe('Iterator on singleton queue', () => {
			it('should not throw when calling iter.next', () => {
				instance.push('string');
				const iter = new QueueIterator(instance);
				expect(() => {
					let res = iter.next();
					res = iter.next();
				}).not.toThrow();
			});

			it('should return true for done', () => {
				instance.push('string');
				const iter = new QueueIterator(instance);
				expect(() => {
					let res = iter.next();
					res = iter.next();
					expect(res.done).toBe(true);
				});
			});

			it('should return null for value', () => {
				instance.push('string');
				const iter = new QueueIterator(instance);
				expect(() => {
					let res = iter.next();
					res = iter.next();
					expect(res.value).toBe(null);
				});
			});
		});
		describe('Iterator on queue', () => {
			it('should not throw when using iterator', () => {
				add10Items(instance);
				instance.push(110);
				const arr: any = [];
				expect(() => {
					for (const item of instance) {
						arr.push(item);
					}
				}).not.toThrow();
			});

			it('should not throw adding new value to queue using for of', () => {
				add10Items(instance);
				instance.push(110);
				const arr: any = [];
				expect(() => {
					for (const item of instance) {
						arr.push(item);
					}
				}).not.toThrow();
				expect(arr.length).toBe(instance.size());
				expect(arr[0]).toBe(10);
				expect(arr[arr.length - 1]).toBe(110);
			});
		});
	});

	describe('QUERY', () => {
		beforeEach(() => {
			add10Items(instance);
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
			const queueSize = instance.size();
			expect(queries.length).toBe(Math.min(queueSize, queryLimit));

			const queryToDelete = queries[0];
			expect(queryToDelete.key()).toBeNull();
			expect(queryToDelete.index()).not.toBeNull();
			queryToDelete.delete();
			expect(queries.length).toBe(queryLength);
			expect(instance.size()).toBe(queueSize - 1);
			queryToDelete.delete();
		});
	});
});
