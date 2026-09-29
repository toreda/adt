import {Queue} from '../src/queue';
import {QueueIterator} from '../src/queue/iterator';
import {type QueueOptions} from '../src/queue/options';

/** Raw ring buffer, for checking allocation and references. */
const bufferOf = (q: Queue<any>): unknown[] => (q as any)._elements;

const repeat = (n: number, f: (n: number) => void) => {
	while (n-- > 0) {
		f(n);
	}
};
const add10Items = (q: Queue<any>) => repeat(10, (n: number) => q.push((10 - n) * 10));

/** Queue whose items wrap around the end of its 16-slot ring buffer. */
const wrapped = (): Queue<number> => {
	const q = new Queue<number>();
	for (let i = 0; i < 14; i++) {
		q.push(i);
	}
	for (let i = 0; i < 12; i++) {
		q.pop();
	}
	for (let i = 14; i < 20; i++) {
		q.push(i);
	}
	// Front is slot 12; items 16 to 19 sit in slots 0 to 3.
	return q;
};

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
			const options: QueueOptions<any> = {
				elements: [1, 2, 3]
			};
			const result = new Queue(options);
			expect(result).toBeInstanceOf(Queue);
			expect(result.size()).toBe(3);
			expect(result.values()).toEqual([1, 2, 3]);
		});

		it('does not keep a reference to the provided array', () => {
			const elements = [1, 2, 3];
			const result = new Queue({elements});
			elements.push(4);
			result.push(5);

			expect(result.values()).toEqual([1, 2, 3, 5]);
			expect(elements).toEqual([1, 2, 3, 4]);
		});

		it('holds more starting elements than the minimum capacity', () => {
			const elements = Array.from({length: 100}, (_, i) => i);

			expect(new Queue({elements}).values()).toEqual(elements);
		});

		it('ignores invalid options instead of throwing', () => {
			expect(new Queue({elements: 'adsf' as any}).size()).toBe(0);
			expect(new Queue({elements: null as any}).size()).toBe(0);
			expect(new Queue(null).size()).toBe(0);
			expect(new Queue('nope' as any).size()).toBe(0);
			expect(new Queue({serializedState: '{"type":"Queue","elements":[4]}'} as any).size()).toBe(0);
		});

		it('has no public state or byte methods', () => {
			const q = new Queue<number>({elements: [1]}) as any;

			expect(q.state).toBeUndefined();
			expect(q.toBytes).toBeUndefined();
			expect(q.toByteEnvelope).toBeUndefined();
			expect(q.toBinary).toBeUndefined();
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
				expect(instance.pop()).toBe(front);
				front = instance.front() as number;
				expect(front).not.toBe(initialFront);
			}

			expect(instance.pop()).toBeNull();
		});

		it('push returns the queue for chaining', () => {
			expect(instance.push(1)).toBe(instance);
			instance.push(2).push(3);
			expect(instance.values()).toEqual([1, 2, 3]);
		});

		it('pop returns the removed item, or null when empty', () => {
			const q = new Queue<string>({elements: ['a', 'b']});

			expect(q.pop()).toBe('a');
			expect(q.pop()).toBe('b');
			expect(q.pop()).toBeNull();
			expect(q.size()).toBe(0);
		});

		it('pop releases the reference to the removed item', () => {
			const item = {id: 1};
			const q = new Queue<object>({elements: [item]});
			q.pop();

			expect(bufferOf(q)).not.toContain(item);
		});

		it('pop does not move the remaining items', () => {
			const q = new Queue<number>({elements: [1, 2, 3, 4]});
			const buffer = bufferOf(q);
			q.pop();

			expect(bufferOf(q)).toBe(buffer);
			expect(buffer.slice(0, 4)).toEqual([undefined, 2, 3, 4]);
		});

		it('keeps order across many wraps and growth', () => {
			const q = new Queue<number>();
			const model: number[] = [];

			for (let i = 0; i < 500; i++) {
				q.push(i);
				model.push(i);
				if (i % 3 === 0) {
					q.push(-i);
					model.push(-i);
				}
				if (i % 2 === 1) {
					expect(q.pop()).toBe(model.shift());
				}
				expect(q.size()).toBe(model.length);
				expect(q.front()).toBe(model[0]);
				expect(q.rear()).toBe(model[model.length - 1]);
			}

			expect(q.values()).toEqual(model);
		});

		it('grows while wrapped and keeps order', () => {
			const q = wrapped();
			for (let i = 20; i < 40; i++) {
				q.push(i);
			}

			expect(q.values()).toEqual(Array.from({length: 28}, (_, i) => i + 12));
			expect(bufferOf(q).length).toBe(32);
		});

		it('does not replace the ring buffer in steady state', () => {
			const q = new Queue<number>();
			for (let i = 0; i < 10; i++) {
				q.push(i);
			}
			const buffer = bufferOf(q);

			for (let i = 0; i < 1000; i++) {
				q.push(i);
				q.pop();
			}

			expect(bufferOf(q)).toBe(buffer);
			expect(buffer.length).toBe(16);
		});

		it('starts with a packed buffer', () => {
			const buffer = bufferOf(new Queue<number>());

			expect(buffer.length).toBe(16);
			for (let i = 0; i < buffer.length; i++) {
				expect(i in buffer).toBe(true);
			}
		});
	});

	describe('at', () => {
		it('counts from the front, and from the rear when negative', () => {
			const q = wrapped();

			expect([0, 1, 7].map((n) => q.at(n))).toEqual([12, 13, 19]);
			expect([-1, -2, -8].map((n) => q.at(n))).toEqual([19, 18, 12]);
		});

		it('returns null outside the queue or for non-integers', () => {
			const q = new Queue<number>({elements: [1, 2, 3]});

			expect(q.at(3)).toBeNull();
			expect(q.at(-4)).toBeNull();
			expect(q.at(0.5)).toBeNull();
			expect(q.at(1.6)).toBeNull();
			expect(q.at(NaN)).toBeNull();
			expect(q.at(Infinity)).toBeNull();
			expect(q.at('1' as any)).toBeNull();
			expect(new Queue<number>().at(0)).toBeNull();
		});

		it('back is an alias of rear', () => {
			const q = wrapped();

			expect(q.back()).toBe(19);
			expect(q.peek()).toBe(12);
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

		it('forEach passes item, position, and the queue itself', () => {
			const q = wrapped();
			const seen: [number, number][] = [];

			expect(
				q.forEach((item, index, queue) => {
					expect(queue).toBe(q);
					seen.push([item, index]);
				})
			).toBe(q);
			expect(seen).toEqual(q.values().map((v, i) => [v, i]));
		});

		it('forEach uses thisArg, defaulting to the queue', () => {
			const context = {};
			const received: unknown[] = [];
			instance.forEach(function (this: unknown) {
				received.push(this);
			}, context);
			expect(received[received.length - 1]).toBe(context);

			instance.forEach(function (this: unknown) {
				received.push(this);
			});
			expect(received[received.length - 1]).toBe(instance);

			instance.forEach(function (this: unknown) {
				received.push(this);
			}, 0);
			expect(received[received.length - 1]).toBe(0);
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

		it('filter passes positions, the queue, and thisArg, and keeps order', () => {
			const q = wrapped();
			const ctx = {skip: 15};
			const result = q.filter(function (this: typeof ctx, item, index, queue) {
				expect(queue).toBe(q);
				return item !== this.skip && index < 6;
			}, ctx);

			expect(result).toBeInstanceOf(Queue);
			expect(result).not.toBe(q);
			expect(result.values()).toEqual([12, 13, 14, 16, 17]);
			expect(q.size()).toBe(8);
		});

		it('reverse', () => {
			const reversed: any = [];

			instance.forEach((e) => {
				reversed.unshift(e);
			});

			expect(instance.reverse()).toBe(instance);

			instance.forEach((e, i) => {
				expect(e).toBe(reversed[i]);
			});

			instance.clearElements();
			instance.push(Math.random());
			const singleItem = instance.peek();
			expect(instance.reverse().peek()).toBe(singleItem);
		});

		it('reverse on a wrapped queue', () => {
			const q = wrapped();
			q.reverse();

			expect(q.values()).toEqual([19, 18, 17, 16, 15, 14, 13, 12]);
			expect(q.pop()).toBe(19);
			q.push(99);
			expect(q.rear()).toBe(99);
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

			it('returns done with a null value', () => {
				const iter = new QueueIterator(instance);
				const res = iter.next();

				expect(res.done).toBe(true);
				expect(res.value).toBeNull();
			});
		});

		describe('Iterator on singleton queue', () => {
			it('returns the item, then done with a null value', () => {
				instance.push('string');
				const iter = new QueueIterator(instance);

				expect(iter.next()).toEqual({value: 'string', done: false});
				expect(iter.next()).toEqual({value: null, done: true});
				expect(iter.next()).toEqual({value: null, done: true});
			});
		});

		describe('Iterator on queue', () => {
			it('visits every item front to rear with for of', () => {
				add10Items(instance);
				instance.push(110);
				const arr: any = [];

				for (const item of instance) {
					arr.push(item);
				}

				expect(arr.length).toBe(instance.size());
				expect(arr[0]).toBe(10);
				expect(arr[arr.length - 1]).toBe(110);
			});

			it('iterates a wrapped queue front to rear', () => {
				expect([...wrapped()]).toEqual([12, 13, 14, 15, 16, 17, 18, 19]);
			});

			it('reuses one result object', () => {
				const iter = new QueueIterator(new Queue<number>({elements: [1, 2]}));
				const first = iter.next();

				expect(first.value).toBe(1);
				expect(iter.next()).toBe(first);
				expect(first.value).toBe(2);
				expect(iter.next()).toBe(first);
				expect(first.done).toBe(true);
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
			expect(queryToDelete.index()).toBe(0);
			expect(queryToDelete.delete()).toBe(10);
			expect(queries.length).toBe(queryLength);
			expect(instance.size()).toBe(queueSize - 1);
			expect(queryToDelete.delete()).toBeNull();
			expect(queryToDelete.index()).toBeNull();
		});

		it('matches front to rear and an empty filter array matches nothing', () => {
			const q = new Queue<number>({elements: [10, 20, 30, 40, 50]});

			expect(q.query((v) => v > 15).map((r) => r.element)).toEqual([20, 30, 40, 50]);
			expect(q.query([(v) => v > 15, (v) => v < 45]).map((r) => r.element)).toEqual([20, 30, 40]);
			expect(q.query([])).toEqual([]);
		});

		it('stops calling filters once the limit is reached', () => {
			const q = new Queue<number>({elements: [10, 20, 30, 40, 50]});
			let calls = 0;
			const results = q.query(
				() => {
					calls++;
					return true;
				},
				{limit: 2}
			);

			expect(results.map((r) => r.element)).toEqual([10, 20]);
			expect(calls).toBe(2);
		});

		it('ignores an invalid limit', () => {
			const q = new Queue<number>({elements: [1, 2, 3]});

			for (const limit of [0, -1, NaN, 'a', null]) {
				expect(q.query(() => true, {limit: limit as any}).length).toBe(3);
			}
		});

		it('results share one key function', () => {
			const [a, b] = instance.query(() => true);

			expect(a.key).toBe(b.key);
		});

		it('index tracks the current position from the front', () => {
			const q = new Queue<number>({elements: [10, 20, 30, 40, 50]});
			const [match] = q.query((v) => v === 30);

			expect(match.index()).toBe(2);
			q.pop();
			expect(match.index()).toBe(1);
		});

		it('delete keeps order in a wrapped queue', () => {
			const q = wrapped();

			expect(q.query((v) => v === 14)[0].delete()).toBe(14);
			expect(q.values()).toEqual([12, 13, 15, 16, 17, 18, 19]);
			q.push(20);
			expect(q.values()).toEqual([12, 13, 15, 16, 17, 18, 19, 20]);
			expect(q.query((v) => v === 20)[0].delete()).toBe(20);
			expect(q.rear()).toBe(19);
		});
	});

	describe('stringify', () => {
		it('serializes items front to rear', () => {
			const q = wrapped();

			expect(q.stringify()).toBe('{"type":"Queue","elements":[12,13,14,15,16,17,18,19]}');
			expect(new Queue().stringify()).toBe('{"type":"Queue","elements":[]}');
		});

		it('returns null instead of throwing for items that cannot be serialized', () => {
			const circular: any = {};
			circular.self = circular;

			expect(new Queue<bigint>({elements: [BigInt(1)]}).stringify()).toBeNull();
			expect(new Queue<any>({elements: [circular]}).stringify()).toBeNull();
		});
	});

	describe('clearElements / reset', () => {
		it('remove every item and keep the ring buffer', () => {
			const a = {id: 'a'};
			const b = {id: 'b'};
			const q = new Queue<object>({elements: [a, b]});
			const buffer = bufferOf(q);

			expect(q.clearElements()).toBe(q);
			expect(q.size()).toBe(0);
			expect(q.front()).toBeNull();
			expect(bufferOf(q)).toBe(buffer);
			expect(buffer).not.toContain(a);
			expect(buffer).not.toContain(b);

			q.push(b);
			expect(q.values()).toEqual([b]);
			expect(q.reset()).toBe(q);
			expect(q.isEmpty()).toBe(true);
			expect(bufferOf(q)).toBe(buffer);
			expect(buffer).not.toContain(b);
		});

		it('clears a wrapped queue', () => {
			const q = wrapped();
			q.clearElements();

			expect(bufferOf(q).every((slot) => slot === undefined)).toBe(true);
			q.push(1);
			expect(q.values()).toEqual([1]);
		});
	});
});
