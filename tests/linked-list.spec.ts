/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import {ADTLinkedList} from '../src/linked-list';
import {ADTLinkedListOptions} from '../src/linked-list/options';

const repeat = (n, f) => {
	while (n-- > 0) f();
};
const add10Items = () => repeat(10, () => list.insert(Math.random()));

const list = new ADTLinkedList();

beforeEach(() => {
	list.reset();
	expect(list.isEmpty()).toBe(true);
});

describe('INSTANTIATION', () => {
	it('default params', () => {
		const result = new ADTLinkedList();
		expect(result).toBeInstanceOf(ADTLinkedList);
		expect(result.size()).toBe(0);
	});

	it('with options', () => {
		const head = 789;
		const tail = 456;
		const options: Required<Omit<ADTLinkedListOptions<any>, 'serializedState'>> = {
			elements: [head, tail]
		};
		const result = new ADTLinkedList(options);

		expect(result).toBeInstanceOf(ADTLinkedList);
		expect(result.size()).toBe(2);
		expect(result.head()?.value()).toBe(head);
		expect(result.tail()?.value()).toBe(tail);
	});

	it('stringify list', () => {
		const stringified = list.stringify();

		expect(new ADTLinkedList({serializedState: stringified})).toEqual(list);
	});

	it('with serialized', () => {
		expect(new ADTLinkedList({serializedState: ''})).toBeInstanceOf(ADTLinkedList);

		const head = 741;
		const tail = 852;
		const source = new ADTLinkedList({elements: [head, null, tail]});
		const serialized = source.stringify();

		const result = new ADTLinkedList({serializedState: serialized});

		expect(result).toBeInstanceOf(ADTLinkedList);
		expect(result.size()).toBe(3);
		expect(result.head()?.value()).toBe(head);
		expect(result.tail()?.value()).toBe(tail);
		expect(result).toEqual(source);
	});

	it('invalid', () => {
		expect(() => {
			const result = new ADTLinkedList({elements: 'adsf' as any});
			console.log(result);
		}).toThrow();

		expect(() => {
			const result = new ADTLinkedList({serializedState: 'null'});
			console.log(result);
		}).toThrow();

		expect(() => {
			const result = new ADTLinkedList({serializedState: 'in{valid'});
			console.log(result);
		}).toThrow();

		expect(() => {
			const result = new ADTLinkedList({serializedState: '{"elements": [4]}'});
			console.log(result);
		}).toThrow();
	});
});

describe('ADDING TO LIST', () => {
	it('insert head', () => {
		const expectedValue = Math.random();
		list.insertAtHead(Math.random());
		list.insertAtHead(expectedValue);
		expect(list.size()).toBe(2);

		const result = list.head()?.value();
		expect(result).toEqual(expectedValue);
	});

	it('insert tail', () => {
		const expectedValue = Math.random();
		list.insertAtTail(Math.random());
		list.insertAtTail(expectedValue);
		expect(list.size()).toBe(2);

		const result = list.tail()?.value();
		expect(result).toBe(expectedValue);
	});
});

describe('REMOVING FROM LIST', () => {
	beforeEach(add10Items);

	it('moves tail/head', () => {
		let expectedSize = list.size();

		const head = list.head();
		const tail = list.tail();
		list.removeNodes([head, null, tail]);
		expectedSize -= 2;

		expect(list.size()).toBe(expectedSize);
		expect(head).not.toBe(list.head());
		expect(tail).not.toBe(list.tail());
	});

	it('stitch list together', () => {
		const middle = list.insert(Math.random());
		repeat(5, () => list.insertAtHead(Math.random()));
		repeat(5, () => list.insertAtTail(Math.random()));

		expect(middle).not.toBe(list.head());
		expect(middle).not.toBe(list.tail());

		const middle_prev = middle?.prev();
		const middle_next = middle?.next();

		list.removeNode(middle);
		expect(middle_prev?.next()).toBe(middle_next);
		expect(middle_next?.prev()).toBe(middle_prev);
	});

	it('reject bad attempt', () => {
		let expectedSize = list.size();

		list.removeNode(null);
		expect(list.size()).toBe(expectedSize);

		const node = list.insert(Math.random());
		expectedSize++;
		expect(list.size()).toBe(expectedSize);

		list.removeNode(node);
		expectedSize--;
		expect(list.size()).toBe(expectedSize);

		list.removeNode(node);
		expect(list.size()).toBe(expectedSize);
	});
});

describe('ARRAY LIKE USAGE', () => {
	beforeEach(add10Items);

	it('convert to array', () => {
		const result = list.getAsArray();

		let node = list.head();
		let index = 0;

		while (node != null) {
			expect(node).toBe(result[index]);
			node = node.next();
			index++;
		}
	});

	it('forEach', () => {
		const asArray = list.getAsArray();

		list.forEach((e, i) => {
			expect(e).toBe(asArray[i]);
		}, list);
	});

	it('filter', () => {
		repeat(5, () => list.insert('random string - ' + Math.random().toString()));

		const strings = list.filter((e) => typeof e.value() === 'string', list);
		const numbers = list.filter((e) => typeof e.value() === 'number');

		expect(strings.size()).toBe(5);
		expect(numbers.size()).toBe(10);

		strings.forEach((e) => {
			expect(e.value()).toContain('random string - ');
		});
	});

	it('reverse', () => {
		const asArray = list.getAsArray();

		expect(list.reverse().getAsArray()).toEqual(asArray.reverse());

		list.clearElements();
		list.insert(Math.random());
		const singleItem = list.getAsArray();
		expect(list.reverse().getAsArray()).toEqual(singleItem.reverse());
	});
});

describe('Iteration', () => {
	beforeEach(add10Items);
	it('should not throw when using for of', () => {
		const arr: any = [];
		expect(() => {
			for (const item of list) {
				arr.push(item);
			}
		}).not.toThrow();
		expect(arr.length).toBe(10);
	});
});

describe('QUERY', () => {
	beforeEach(add10Items);

	it('array of matches', () => {
		list.head()?.value(null);
		const above = list.query((value) => (value as number) > 0.5);
		const below = list.query((value) => (value as number) < 0.5);

		expect(above.length + below.length).toBe(list.size() - 1);

		expect(
			above.every((res) => {
				const value = res.element.value() as number;
				return value > 0.5;
			})
		).toBe(true);

		expect(
			below.every((res) => {
				const value = res.element.value() as number;
				return value < 0.5;
			})
		).toBe(true);
	});

	it('using queries', () => {
		const queryLimit = 1;
		list.head()?.value(null);
		const queries = list.query([(v) => typeof v === 'number', (v) => !!v], {limit: queryLimit});
		const queryLength = queries.length;
		const listSize = list.size();
		expect(queries.length).toBe(Math.min(listSize, queryLimit));

		const queryToDelete = queries[0];
		expect(queryToDelete.key()).toBeNull();
		expect(queryToDelete.index()).toBeNull();
		queryToDelete.delete();
		expect(queries.length).toBe(queryLength);
		expect(list.size()).toBe(listSize - 1);
		expect(queryToDelete.element.next()).toBe(null);
		expect(queryToDelete.element.prev()).toBe(null);
	});
});
