import {Stack} from '../src/stack';
import {StackIterator} from '../src/stack/iterator';
import {type StackOptions} from '../src/stack/options';

const repeat = (n: number, f: Function) => {
	while (n-- > 0) {
		f(n);
	}
};
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

		it('with options', () => {
			const options: Required<Omit<StackOptions<any>, 'serializedState'>> = {
				elements: [1, 2, 3]
			};
			const result = new Stack(options);
			expect(result).toBeInstanceOf(Stack);
			expect(result.size()).toBe(3);
		});

		it('stringify stack', () => {
			const stringified = instance.stringify();
			expect(stringified).not.toBeNull();
			expect(new Stack({serializedState: stringified as string})).toEqual(instance);
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

		it('with serialized', () => {
			expect(new Stack({serializedState: ''})).toBeInstanceOf(Stack);
			const source = new Stack({elements: [2, 3, 4]});
			const serialized = source.stringify();
			const result = new Stack({serializedState: serialized});
			expect(result).toBeInstanceOf(Stack);
			expect(result.size()).toBe(3);
			expect(result).toEqual(source);
		});

		it('invalid', () => {
			expect(() => {
				const result = new Stack({elements: 'adsf' as any});
				console.log(result);
			}).toThrow();

			expect(() => {
				const result = new Stack({serializedState: 'null'});
				console.log(result);
			}).toThrow();

			expect(() => {
				const result = new Stack({serializedState: 'in{valid'});
				console.log(result);
			}).toThrow();

			expect(() => {
				const result = new Stack({serializedState: '{"elements": [4]}'});
				console.log(result);
			}).toThrow();
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

		it('forEach index and arr are top first', () => {
			const expected = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10];

			instance.forEach((e, i, arr) => {
				expect(i).toBe(expected.indexOf(e));
				expect(arr).toEqual(expected);
			});
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

	describe('Iterator', () => {
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
					let res = iter.next();
					res = iter.next();
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
