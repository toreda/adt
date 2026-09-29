import {Stack} from '../src/stack';
import {StackIterator} from '../src/stack/iterator';

const repeat = (n: number, f: (n: number) => unknown) => {
	while (n-- > 0) {
		f(n);
	}
};
/** The stack's private backing array, including spare slots. */
const backingOf = <T>(stack: Stack<T>): (T | undefined)[] => (stack as any)._elements;
const add10Items = (stack: Stack<any>) => repeat(10, (n: number) => stack.push((10 - n) * 10));

describe('Stack', () => {
	let instance: Stack<any>;

	beforeAll(() => {
		instance = new Stack<any>();
	});

	beforeEach(() => {
		instance.reset();
		expect(instance.size()).toBe(0);
	});

	describe('INSTANTIATION', () => {
		it('default params', () => {
			const result = new Stack();
			expect(result).toBeInstanceOf(Stack);
			expect(result.size()).toBe(0);
		});

		it('with seed data pushed bottom to top', () => {
			const result = new Stack([1, 2, 3]);
			expect(result).toBeInstanceOf(Stack);
			expect(result.size()).toBe(3);
			expect(result.top()).toBe(3);
			expect(result.bottom()).toBe(1);
		});

		it('stringify stack', () => {
			instance.push(1).push(2);
			expect(instance.stringify()).toBe('{"type":"Stack","elements":[1,2]}');
		});

		it('ignores the removed serializedState option', () => {
			const result = new Stack(null, {serializedState: '{"type":"Stack","elements":[4]}'} as any);
			expect(result.size()).toBe(0);
		});

		it('copies the data array', () => {
			const data = [1, 2, 3];
			const result = new Stack(data);
			result.push(4);
			expect(data).toEqual([1, 2, 3]);
			expect(result.top()).toBe(4);
		});

		it('has no toBinary stub', () => {
			expect((new Stack() as any).toBinary).toBeUndefined();
		});

		it('stringify returns null for unserializable elements', () => {
			const circular: any = {};
			circular.self = circular;
			instance.push(circular);
			expect(instance.stringify()).toBeNull();

			instance.clearElements();
			instance.push(BigInt(1));
			expect(instance.stringify()).toBeNull();
		});

		it('ignores non-array data instead of throwing', () => {
			expect(new Stack('adsf' as any).size()).toBe(0);
			expect(new Stack({elements: [4]} as any).size()).toBe(0);
		});
	});

	describe('PUSH/POP', () => {
		it('static bottom, move top', () => {
			expect(instance.bottom()).toBeNull();
			expect(instance.top()).toBeNull();

			const bottom = 99;
			instance.push(bottom);
			expect(instance.bottom()).toBe(bottom);

			[13, 24, 35, 46, 57, 68].forEach((v) => {
				instance.push(v);
				expect(instance.top()).toBe(v);
				expect(instance.bottom()).toBe(bottom);
			});

			const initialTop = instance.top();
			let top = instance.top();

			while (instance.size()) {
				expect(instance.top()).toBe(top);
				expect(instance.bottom()).toBe(bottom);
				expect(instance.pop()).toBe(top);
				top = instance.top();
				expect(top).not.toBe(initialTop);
			}

			expect(instance.pop()).toBeNull();
		});

		it('pop returns the removed element', () => {
			instance.push('a').push('b');
			expect(instance.pop()).toBe('b');
			expect(instance.pop()).toBe('a');
			expect(instance.pop()).toBeNull();
			expect(instance.size()).toBe(0);
		});

		it('peek does not remove the element', () => {
			expect(instance.peek()).toBeNull();
			instance.push(7);
			expect(instance.peek()).toBe(7);
			expect(instance.size()).toBe(1);
		});
	});

	describe('AT', () => {
		beforeEach(() => {
			add10Items(instance);
		});

		it('returns element counted down from the top', () => {
			expect(instance.at(0)).toBe(100);
			expect(instance.at(0)).toBe(instance.top());
			expect(instance.at(9)).toBe(10);
			expect(instance.at(9)).toBe(instance.bottom());
		});

		it('matches forEach index', () => {
			instance.forEach((e, i) => {
				expect(instance.at(i)).toBe(e);
			});
		});

		it('returns null for out of range positions', () => {
			expect(instance.at(-1)).toBeNull();
			expect(instance.at(10)).toBeNull();
		});

		it('returns null for non-integer positions', () => {
			expect(instance.at(1.5)).toBeNull();
			expect(instance.at(NaN)).toBeNull();
			expect(instance.at(Infinity)).toBeNull();
			expect(instance.at('1' as any)).toBeNull();
		});

		it('returns null on empty stack', () => {
			instance.clearElements();
			expect(instance.at(0)).toBeNull();
		});
	});

	describe('ARRAY LIKE USAGE', () => {
		beforeEach(() => {
			add10Items(instance);
		});

		it('forEach', () => {
			const topToBot: any = [];

			instance.forEach((e: any) => {
				topToBot.push(e);
			}, instance);

			topToBot.forEach((e: any) => {
				expect(e).toBe(instance.peek());
				instance.pop();
			});
		});

		it('forEach index is top first and third argument is the stack', () => {
			const expected = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10];
			const seen: number[] = [];

			instance.forEach((e, i, stack) => {
				expect(i).toBe(expected.indexOf(e));
				expect(stack).toBe(instance);
				expect(stack.at(i)).toBe(e);
				seen.push(e);
			});

			expect(seen).toEqual(expected);
		});

		it('forEach does not copy the backing array', () => {
			const sliceSpy = jest.spyOn(Array.prototype, 'slice');
			const reverseSpy = jest.spyOn(Array.prototype, 'reverse');

			try {
				instance.forEach(() => {});
				expect(sliceSpy).not.toHaveBeenCalled();
				expect(reverseSpy).not.toHaveBeenCalled();
			} finally {
				sliceSpy.mockRestore();
				reverseSpy.mockRestore();
			}
		});

		it('forEach defaults this to the stack', () => {
			const seen: unknown[] = [];

			instance.forEach(function (this: unknown) {
				seen.push(this);
			});

			expect(seen.length).toBe(instance.size());
			expect(seen.every((ctx) => ctx === instance)).toBe(true);
		});

		it('forEach uses thisArg', () => {
			const ctx = {hits: 0};

			instance.forEach(function (this: typeof ctx) {
				this.hits++;
			}, ctx);

			expect(ctx.hits).toBe(instance.size());
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

		it('filter passes top first index and the stack', () => {
			const indexes: number[] = [];

			instance.filter((e, i, stack) => {
				expect(stack).toBe(instance);
				expect(stack.at(i)).toBe(e);
				indexes.push(i);
				return true;
			});

			expect(indexes).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
		});

		it('filter result is independent of the source', () => {
			const all = instance.filter(() => true);
			expect(all.state.elements).toEqual(instance.state.elements);
			expect(all.state.elements).not.toBe(instance.state.elements);
			all.pop();
			expect(instance.size()).toBe(10);
		});

		it('filter preserves element order', () => {
			const evens = instance.filter((e) => e % 20 === 0);

			expect(evens.state.elements).toEqual([20, 40, 60, 80, 100]);
			expect(evens.top()).toBe(100);
			expect(evens.bottom()).toBe(20);
			expect(instance.size()).toBe(10);
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

	describe('CLEAR', () => {
		it('clearElements keeps the backing array', () => {
			add10Items(instance);
			const backing = backingOf(instance);

			instance.clearElements();
			expect(instance.size()).toBe(0);
			expect(backingOf(instance)).toBe(backing);
			expect(instance.pop()).toBeNull();

			instance.push(5);
			expect(instance.top()).toBe(5);
		});

		it('reset keeps the backing array', () => {
			add10Items(instance);
			const backing = backingOf(instance);

			instance.reset();
			expect(instance.size()).toBe(0);
			expect(backingOf(instance)).toBe(backing);
		});
	});

	describe('CAPACITY', () => {
		it('pop keeps the backing array at its high-water length', () => {
			const stack = new Stack<number>();
			repeat(1000, (n) => stack.push(n));

			for (let i = 0; i < 990; i++) {
				stack.pop();
			}

			expect(stack.size()).toBe(10);
			expect(backingOf(stack).length).toBe(1000);
		});

		it('clearElements and reset keep the high-water length', () => {
			const stack = new Stack<number>();
			repeat(500, (n) => stack.push(n));

			stack.clearElements();
			expect(stack.size()).toBe(0);
			expect(backingOf(stack).length).toBe(500);

			repeat(200, (n) => stack.push(n));
			stack.reset();
			expect(backingOf(stack).length).toBe(500);
		});

		it('drops references to popped and cleared elements', () => {
			const a = {id: 'a'};
			const b = {id: 'b'};
			const c = {id: 'c'};
			const stack = new Stack<object>([a, b, c]);

			expect(stack.pop()).toBe(c);
			expect(backingOf(stack)).not.toContain(c);
			expect(backingOf(stack)[2]).toBeUndefined();

			stack.clearElements();
			expect(backingOf(stack).every((slot) => slot === undefined)).toBe(true);
		});

		it('query delete keeps the length and drops the reference', () => {
			const x = {id: 'x'};
			const stack = new Stack<object>([{id: 1}, x, {id: 2}]);

			expect(stack.query((v) => v === x)[0].delete()).toBe(x);
			expect(stack.size()).toBe(2);
			expect(backingOf(stack).length).toBe(3);
			expect(backingOf(stack)).not.toContain(x);
		});

		it('ignores spare slots in every read', () => {
			const stack = new Stack<number>([1, 2, 3, 4, 5]);
			stack.pop();
			stack.pop();

			expect(stack.size()).toBe(3);
			expect(stack.top()).toBe(3);
			expect(stack.bottom()).toBe(1);
			expect(stack.at(2)).toBe(1);
			expect(stack.at(3)).toBeNull();
			expect(stack.values()).toEqual([3, 2, 1]);
			expect([...stack]).toEqual([3, 2, 1]);
			expect(stack.state.elements).toEqual([1, 2, 3]);
			expect(stack.stringify()).toBe('{"type":"Stack","elements":[1,2,3]}');

			const seen: number[] = [];
			stack.forEach((v) => {
				seen.push(v);
			});
			expect(seen).toEqual([3, 2, 1]);
			expect(stack.filter(() => true).values()).toEqual([3, 2, 1]);
			expect(stack.query(() => true).length).toBe(3);

			stack.reverse();
			expect(stack.values()).toEqual([1, 2, 3]);
			expect(backingOf(stack).slice(3)).toEqual([undefined, undefined]);
		});

		it('gives correct results over repeated fill and drain cycles', () => {
			const stack = new Stack<number>();

			for (let cycle = 0; cycle < 5; cycle++) {
				const count = cycle % 2 === 0 ? 50 : 20;

				for (let i = 0; i < count; i++) {
					stack.push(cycle * 100 + i);
				}

				expect(stack.size()).toBe(count);
				expect(stack.top()).toBe(cycle * 100 + count - 1);

				for (let i = count - 1; i >= 0; i--) {
					expect(stack.pop()).toBe(cycle * 100 + i);
				}

				expect(stack.pop()).toBeNull();
				expect(stack.isEmpty()).toBe(true);
				expect(backingOf(stack).length).toBe(50);
			}
		});

		it('state is a snapshot of the live elements', () => {
			const stack = new Stack<number>([1, 2, 3]);
			stack.pop();

			const state = stack.state;
			expect(state).toEqual({type: 'Stack', elements: [1, 2]});

			state.elements.push(99);
			expect(stack.size()).toBe(2);
			expect(stack.state).not.toBe(state);
		});
	});

	describe('Iterator', () => {
		it('reuses one result object per iterator', () => {
			instance.push(1).push(2);
			const iter = new StackIterator(instance);
			const first = iter.next();
			expect(first.value).toBe(2);
			const second = iter.next();
			expect(second).toBe(first);
			expect(second.value).toBe(1);
			const done = iter.next();
			expect(done).toBe(first);
			expect(done.done).toBe(true);
			expect(done.value).toBeNull();
		});

		describe('Iterator for empty stack', () => {
			it('should not throw when calling iter.next', () => {
				const iter = new StackIterator(instance);
				expect(() => {
					iter.next();
				}).not.toThrow();
			});

			it('should return true for done', () => {
				const iter = new StackIterator(instance);
				const res = iter.next();
				expect(res.done).toBe(true);
			});

			it('should return null for value', () => {
				const iter = new StackIterator(instance);
				const res = iter.next();
				expect(res.value).toBe(null);
			});
		});
		describe('Iterator on singleton', () => {
			it('should not throw when calling iter.next', () => {
				instance.push('string');
				const iter = new StackIterator(instance);
				expect(() => {
					iter.next();
					iter.next();
				}).not.toThrow();
			});

			it('should return the element then done', () => {
				instance.push('string');
				const iter = new StackIterator(instance);
				let res = iter.next();
				expect(res.value).toBe('string');
				expect(res.done).toBe(false);
				res = iter.next();
				expect(res.done).toBe(true);
				expect(res.value).toBe(null);
			});
		});
		describe('Iterator on stack', () => {
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

			it('should iterate from top to bottom', () => {
				add10Items(instance);
				instance.push(110);
				const arr: any = [];
				for (const item of instance) {
					arr.push(item);
				}
				expect(arr.length).toBe(instance.size());
				expect(arr[0]).toBe(110);
				expect(arr[arr.length - 1]).toBe(10);
			});

			it('should match forEach order', () => {
				add10Items(instance);
				const viaForEach: any = [];
				instance.forEach((e) => viaForEach.push(e));
				expect([...instance]).toEqual(viaForEach);
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
			const stackSize = instance.size();
			expect(queries.length).toBe(Math.min(stackSize, queryLimit));

			const queryToDelete = queries[0];
			expect(queryToDelete.key()).toBeNull();
			expect(queryToDelete.index()).not.toBeNull();
			queryToDelete.delete();
			expect(queries.length).toBe(queryLength);
			expect(instance.size()).toBe(stackSize - 1);
			// Deleting an already deleted result must not remove anything else.
			queryToDelete.delete();
			expect(instance.size()).toBe(stackSize - 1);
			expect(queryToDelete.index()).toBeNull();
		});

		it('results are top first and stop at limit', () => {
			const results = instance.query(() => true, {limit: 3});
			expect(results.map((r) => r.element)).toEqual([100, 90, 80]);
			expect(results.map((r) => r.index())).toEqual([0, 1, 2]);
		});

		it('an empty filter array matches nothing', () => {
			expect(instance.query([])).toEqual([]);
		});

		it('array filters stop at the first failing filter', () => {
			const second = jest.fn(() => true);
			const results = instance.query([() => false, second]);
			expect(results).toEqual([]);
			expect(second).not.toHaveBeenCalled();
		});

		it('stops visiting elements once the limit is reached', () => {
			const filter = jest.fn(() => true);
			instance.query(filter, {limit: 2});
			expect(filter).toHaveBeenCalledTimes(2);
		});

		it('results share one key function', () => {
			const results = instance.query(() => true, {limit: 2});
			expect(results[0].key).toBe(results[1].key);
		});

		it('delete keeps the remaining order', () => {
			instance.query((v) => v === 50)[0].delete();
			expect(instance.state.elements).toEqual([10, 20, 30, 40, 60, 70, 80, 90, 100]);
		});

		it('index is usable with at()', () => {
			instance
				.query(() => true)
				.forEach((r) => {
					expect(instance.at(r.index() as number)).toBe(r.element);
				});
		});

		it('duplicate values track their own element', () => {
			instance.clearElements();
			[1, 2, 1].forEach((v) => instance.push(v));

			const results = instance.query((v) => v === 1);
			expect(results.length).toBe(2);
			expect(results[0].index()).toBe(0);
			expect(results[1].index()).toBe(2);

			// Deleting the top match removes the top 1, not the bottom one.
			expect(results[0].delete()).toBe(1);
			expect(instance.state.elements).toEqual([1, 2]);
			expect(results[0].index()).toBeNull();
			expect(results[1].index()).toBe(1);
		});

		it('index tracks the element as the stack changes', () => {
			instance.clearElements();
			[1, 2, 3, 4].forEach((v) => instance.push(v));

			const [four, three, , one] = instance.query(() => true);
			expect(three.index()).toBe(1);

			// Deleting below does not move it relative to the top.
			one.delete();
			expect(three.index()).toBe(1);
			expect(instance.at(1)).toBe(3);

			// Removing above brings it closer to the top.
			expect(instance.pop()).toBe(4);
			expect(four.index()).toBeNull();
			expect(three.index()).toBe(0);

			// Removing the element itself.
			expect(instance.pop()).toBe(3);
			expect(three.index()).toBeNull();
		});
	});
});
