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
			expect(new Stack({serializedState: stringified})).toEqual(instance);
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
				instance.pop();
				top = instance.top();
				expect(top).not.toBe(initialTop);
			}

			instance.pop();
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
		describe('Iterator for empty stack', () => {
			it('should not throw when calling iter.next', () => {
				const iter = new StackIterator(instance);
				expect(() => {
					iter.next();
				}).not.toThrow();
			});

			it('should return true for done', () => {
				const iter = new StackIterator(instance);
				expect(() => {
					const res = iter.next();
					expect(res.done).toBe(true);
				});
			});

			it('should return null for value', () => {
				const iter = new StackIterator(instance);
				expect(() => {
					const res = iter.next();
					expect(res.value).toBe(null);
				});
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

			it('should return true for done', () => {
				instance.push('string');
				const iter = new StackIterator(instance);
				expect(() => {
					let res = iter.next();
					res = iter.next();
					expect(res.done).toBe(true);
				});
			});

			it('should return null for value', () => {
				instance.push('string');
				const iter = new StackIterator(instance);
				expect(() => {
					let res = iter.next();
					res = iter.next();
					expect(res.value).toBe(null);
				});
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

			it('should not throw adding element to the stack using for of', () => {
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
			const stackSize = instance.size();
			expect(queries.length).toBe(Math.min(stackSize, queryLimit));

			const queryToDelete = queries[0];
			expect(queryToDelete.key()).toBeNull();
			expect(queryToDelete.index()).not.toBeNull();
			queryToDelete.delete();
			expect(queries.length).toBe(queryLength);
			expect(instance.size()).toBe(stackSize - 1);
			queryToDelete.delete();
		});
	});
});
