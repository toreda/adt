/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import {Stack} from '../src/stack';
import {StackOptions} from '../src/stack/options';
import {StackIterator} from '../src/stack/iterator';

const repeat = (n, f) => {
	while (n-- > 0) f(n);
};
const add10Items = () => repeat(10, (n) => stack.push((10 - n) * 10));

const stack = new Stack();

beforeEach(() => {
	stack.reset();
	expect(stack.size()).toBe(0);
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
		const stringified = stack.stringify();
		expect(new Stack({serializedState: stringified})).toEqual(stack);
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
		expect(stack.bottom()).toBeNull();
		expect(stack.top()).toBeNull();

		const bottom = 99;
		stack.push(bottom);
		expect(stack.bottom()).toBe(bottom);

		[13, 24, 35, 46, 57, 68].forEach((v) => {
			stack.push(v);
			expect(stack.top()).toBe(v);
			expect(stack.bottom()).toBe(bottom);
		});

		const initialTop = stack.top();
		let top = stack.top();

		while (stack.size()) {
			expect(stack.top()).toBe(top);
			expect(stack.bottom()).toBe(bottom);
			stack.pop();
			top = stack.top();
			expect(top).not.toBe(initialTop);
		}

		stack.pop();
	});
});

describe('ARRAY LIKE USAGE', () => {
	beforeEach(add10Items);

	it('forEach', () => {
		const topToBot: any = [];

		stack.forEach((e) => {
			topToBot.push(e);
		}, stack);

		topToBot.forEach((e) => {
			expect(e).toBe(stack.peek());
			stack.pop();
		});
	});

	it('filter', () => {
		repeat(5, () => stack.push('random string - ' + Math.random().toString()));

		const strings = stack.filter((e) => typeof e === 'string', stack);
		const numbers = stack.filter((e) => typeof e === 'number');

		expect(strings.size()).toBe(5);
		expect(numbers.size()).toBe(10);

		strings.forEach((e) => {
			expect(e).toContain('random string - ');
		});
	});

	it('reverse', () => {
		const reversed: any = [];

		stack.forEach((e) => {
			reversed.unshift(e);
		});

		stack.reverse();

		stack.forEach((e, i) => {
			expect(e).toBe(reversed[i]);
		});

		stack.clearElements();
		stack.push(Math.random());
		const singleItem = stack.peek();
		expect(stack.reverse().peek()).toBe(singleItem);
	});
});

describe('Iterator', () => {
	describe('Iterator for empty stack', () => {
		it('should not throw when calling iter.next', () => {
			const iter = new StackIterator(stack);
			expect(() => {
				iter.next();
			}).not.toThrow();
		});

		it('should return true for done', () => {
			const iter = new StackIterator(stack);
			expect(() => {
				const res = iter.next();
				expect(res.done).toBe(true);
			});
		});

		it('should return null for value', () => {
			const iter = new StackIterator(stack);
			expect(() => {
				const res = iter.next();
				expect(res.value).toBe(null);
			});
		});
	});
	describe('Iterator on singleton stack', () => {
		it('should not throw when calling iter.next', () => {
			stack.push('string');
			const iter = new StackIterator(stack);
			expect(() => {
				let res = iter.next();
				res = iter.next();
			}).not.toThrow();
		});

		it('should return true for done', () => {
			stack.push('string');
			const iter = new StackIterator(stack);
			expect(() => {
				let res = iter.next();
				res = iter.next();
				expect(res.done).toBe(true);
			});
		});

		it('should return null for value', () => {
			stack.push('string');
			const iter = new StackIterator(stack);
			expect(() => {
				let res = iter.next();
				res = iter.next();
				expect(res.value).toBe(null);
			});
		});
	});
	describe('Iterator on stack', () => {
		it('should not throw when using iterator', () => {
			add10Items();
			stack.push(110);
			const arr: any = [];
			expect(() => {
				for (const item of stack) {
					arr.push(item);
				}
			}).not.toThrow();
		});

		it('should not throw adding element to the stack using for of', () => {
			add10Items();
			stack.push(110);
			const arr: any = [];
			expect(() => {
				for (const item of stack) {
					arr.push(item);
				}
			}).not.toThrow();
			expect(arr.length).toBe(stack.size());
			expect(arr[0]).toBe(10);
			expect(arr[arr.length - 1]).toBe(110);
		});
	});
});

describe('QUERY', () => {
	beforeEach(add10Items);

	it('array of matches', () => {
		stack.push(null);
		const above = stack.query((value) => (value as number) > 55);
		const below = stack.query((value) => (value as number) < 55);

		expect(above.length + below.length).toBe(stack.size());

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
		stack.push(null);
		const queryLimit = 1;
		const queries = stack.query([(v) => typeof v === 'number', (v) => !!v], {limit: queryLimit});
		const queryLength = queries.length;
		const stackSize = stack.size();
		expect(queries.length).toBe(Math.min(stackSize, queryLimit));

		const queryToDelete = queries[0];
		expect(queryToDelete.key()).toBeNull();
		expect(queryToDelete.index()).not.toBeNull();
		queryToDelete.delete();
		expect(queries.length).toBe(queryLength);
		expect(stack.size()).toBe(stackSize - 1);
		queryToDelete.delete();
	});
});
