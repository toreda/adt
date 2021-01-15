/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import {ADTStack} from '../src/stack';

const repeat = (n, f) => {
	while (n-- > 0) f(n);
};
const add10Items = () => repeat(10, (n) => stack.push((10 - n) * 10));

const stack = new ADTStack();

beforeEach(() => {
	stack.reset();
	expect(stack.size()).toBe(0);
});

describe('INSTANTIATION', () => {
	it('default params', () => {
		const result = new ADTStack();
		expect(result).toBeInstanceOf(ADTStack);
		expect(result.size()).toBe(0);
	});

	it('with options', () => {
		const result = new ADTStack({elements: [1, 2, 3]});
		expect(result).toBeInstanceOf(ADTStack);
		expect(result.size()).toBe(3);
	});

	it('stringify stack', () => {
		const stringified = stack.stringify();
		expect(new ADTStack({serializedState: stringified})).toEqual(stack);
	});

	it('with serialized', () => {
		expect(new ADTStack({serializedState: ''})).toBeInstanceOf(ADTStack);
		const serialized = new ADTStack({elements: [2, 3, 4]}).stringify();
		const result = new ADTStack({serializedState: serialized});
		expect(result).toBeInstanceOf(ADTStack);
		expect(result.size()).toBe(3);
	});

	it('invalid', () => {
		expect(() => {
			const result = new ADTStack({elements: 'adsf' as any});
			console.log(result);
		}).toThrow();

		expect(() => {
			const result = new ADTStack({serializedState: 'null'});
			console.log(result);
		}).toThrow();

		expect(() => {
			const result = new ADTStack({serializedState: 'in{valid'});
			console.log(result);
		}).toThrow();

		expect(() => {
			const result = new ADTStack({serializedState: '{"elements": [4]}'});
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
