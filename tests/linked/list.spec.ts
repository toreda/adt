import {LinkedList} from '../../src/linked/list';
import {LinkedListIterator} from '../../src/linked/list/iterator';
import {ObjectPool} from '../../src/object/pool';

const poolOf = (target: LinkedList<any>): ObjectPool<any> | null => (target as any).elements.objectPool;

const repeat = (n: number, f: () => void) => {
	while (n-- > 0) f();
};

const add10Items = () => repeat(10, () => list.insert(Math.random()));

const list = new LinkedList();

describe('LinkedList', () => {
	beforeEach(() => {
		list.reset();
		expect(list.isEmpty()).toBe(true);
	});

	describe('INSTANTIATION', () => {
		it('default params', () => {
			const result = new LinkedList();
			expect(result).toBeInstanceOf(LinkedList);
			expect(result.size()).toBe(0);
		});

		it('with elements', () => {
			const head = 789;
			const tail = 456;
			const result = new LinkedList([head, tail]);

			expect(result).toBeInstanceOf(LinkedList);
			expect(result.size()).toBe(2);
			expect(result.head()?.value()).toBe(head);
			expect(result.tail()?.value()).toBe(tail);
		});

		it('does not keep a reference to the provided array', () => {
			const elements = [1, 2, 3];
			const result = new LinkedList(elements);
			elements.push(4);

			expect(result.size()).toBe(3);
		});

		it('with options', () => {
			const result = new LinkedList<number>([1, 2], {});

			expect(result).toBeInstanceOf(LinkedList);
			expect(result.size()).toBe(2);
		});

		it('ignores invalid data and options instead of throwing', () => {
			expect(new LinkedList('adsf' as any).size()).toBe(0);
			expect(new LinkedList(null).size()).toBe(0);
			expect(new LinkedList({elements: [4]} as any).size()).toBe(0);
			expect(new LinkedList(new Uint8Array([1, 2, 3]) as any).size()).toBe(0);
			expect(new LinkedList([1], null).size()).toBe(1);
			expect(new LinkedList([1], 'nope' as any).size()).toBe(1);
		});

		it('has no byte methods; those belong to ByteLinkedList', () => {
			const result = new LinkedList([1]) as any;

			expect(result.toBytes).toBeUndefined();
			expect(result.toByteEnvelope).toBeUndefined();
		});
	});

	describe('ELEMENT POOLING', () => {
		it('is enabled by default', () => {
			expect(poolOf(new LinkedList())).toBeInstanceOf(ObjectPool);
			expect(poolOf(new LinkedList([1, 2], {}))).toBeInstanceOf(ObjectPool);
		});

		it('only strict true disables it', () => {
			expect(poolOf(new LinkedList([], {disableElementPooling: true}))).toBeNull();
			expect(poolOf(new LinkedList([], {disableElementPooling: false}))).toBeInstanceOf(ObjectPool);
			expect(poolOf(new LinkedList([], {disableElementPooling: 'true' as any}))).toBeInstanceOf(
				ObjectPool
			);
			expect(poolOf(new LinkedList([], {disableElementPooling: 1 as any}))).toBeInstanceOf(ObjectPool);
			expect(poolOf(new LinkedList([], {disableElementPooling: null as any}))).toBeInstanceOf(
				ObjectPool
			);
		});

		it('behaves the same with pooling disabled', () => {
			const plain = new LinkedList<number>([1, 2, 3], {disableElementPooling: true});
			const node = plain.insert(4);

			expect(plain.size()).toBe(4);
			expect(plain.removeNode(node)).toBe(4);
			expect(plain.removeNode(plain.head())).toBe(1);
			expect(plain.values()).toEqual([2, 3]);
			expect(plain.clearElements().size()).toBe(0);
		});

		it('recycles a removed node for a later insert', () => {
			const pooled = new LinkedList<string>();
			const first = pooled.insert('a');
			pooled.removeNode(first);

			const second = pooled.insert('b');

			expect(second).toBe(first);
			expect(second?.value()).toBe('b');
			expect(pooled.values()).toEqual(['b']);
		});

		it('does not recycle when pooling is disabled', () => {
			const plain = new LinkedList<string>([], {disableElementPooling: true});
			const first = plain.insert('a');
			plain.removeNode(first);

			expect(plain.insert('b')).not.toBe(first);
			expect(first?.value()).toBeNull();
		});

		it('removeNode with pooling disabled returns the value and blanks the node', () => {
			const plain = new LinkedList<string>(['a', 'b', 'c'], {disableElementPooling: true});
			const middle = plain.head()?.next() as any;

			expect(plain.removeNode(middle)).toBe('b');
			expect(middle.value()).toBeNull();
			expect(middle.next()).toBeNull();
			expect(middle.prev()).toBeNull();
			expect(middle._list).toBeNull();
			expect(plain.values()).toEqual(['a', 'c']);
		});

		it('removeNode returns the value, not the blanked node', () => {
			const pooled = new LinkedList<number>([5, 6, 7]);
			const middle = pooled.head()?.next() as any;

			expect(pooled.removeNode(middle)).toBe(6);
			expect(middle.value()).toBeNull();
			expect(middle.next()).toBeNull();
			expect(middle.prev()).toBeNull();
			expect(pooled.values()).toEqual([5, 7]);
		});

		it('query delete returns the value', () => {
			const pooled = new LinkedList<number>([5, 6, 7]);
			const [match] = pooled.query((v) => v === 6);

			expect(match.delete()).toBe(6);
			expect(match.delete()).toBeNull();
			expect(pooled.values()).toEqual([5, 7]);
		});

		it('stale query delete does not remove the item that reused its node', () => {
			const pooled = new LinkedList<string>(['a', 'b']);
			const [match] = pooled.query((v) => v === 'a');

			expect(match.delete()).toBe('a');
			const reused = pooled.insert('c');

			expect(reused).toBe(match.element);
			expect(match.delete()).toBeNull();
			expect(pooled.values()).toEqual(['b', 'c']);
		});

		it('stale query delete is a no-op after removal by other means', () => {
			const pooled = new LinkedList<string>(['a']);
			const [match] = pooled.query((v) => v === 'a');

			pooled.removeNode(pooled.head());
			pooled.insert('a');

			expect(match.delete()).toBeNull();
			expect(pooled.values()).toEqual(['a']);
		});

		it('removing a node twice returns null the second time', () => {
			const pooled = new LinkedList<number>([1]);
			const node = pooled.head();

			expect(pooled.removeNode(node)).toBe(1);
			expect(pooled.removeNode(node)).toBeNull();
			expect(pooled.size()).toBe(0);
		});

		it('clearElements returns every node to the pool', () => {
			const pooled = new LinkedList<number>([1, 2, 3]);
			const before = pooled.toArray();
			pooled.clearElements();

			expect(poolOf(pooled)?.size()).toBe(0);
			expect(before.every((n) => n.value() === null && n.next() === null && n.prev() === null)).toBe(
				true
			);

			pooled.insertArray([4, 5, 6]);
			const after = pooled.toArray();

			expect(after.every((n) => before.includes(n))).toBe(true);
			expect(pooled.values()).toEqual([4, 5, 6]);
		});

		it('pool grows with demand and tracks live nodes', () => {
			const pooled = new LinkedList<number>();
			const count = 50;

			for (let i = 0; i < count; i++) {
				pooled.insert(i);
			}

			expect(poolOf(pooled)?.size()).toBe(count);
			expect(pooled.size()).toBe(count);

			pooled.reset();

			expect(poolOf(pooled)?.size()).toBe(0);
		});

		it('falls back to allocation when the pool cannot supply a node', () => {
			const pooled = new LinkedList<number>();
			jest.spyOn(poolOf(pooled) as ObjectPool<any>, 'allocate').mockReturnValue(null);

			const node = pooled.insert(9);

			expect(node?.value()).toBe(9);
			expect(pooled.size()).toBe(1);
		});

		it('filter carries the pooling setting', () => {
			const pooled = new LinkedList<number>([1, 2]);
			const plain = new LinkedList<number>([1, 2], {disableElementPooling: true});

			expect(poolOf(pooled.filter(() => true))).toBeInstanceOf(ObjectPool);
			expect(poolOf(plain.filter(() => true))).toBeNull();
		});

		it('pool options are passed to the internal pool over the defaults', () => {
			const pooled = new LinkedList<number>([], {pool: {maxSize: 2, startSize: 2}});
			const state = (poolOf(pooled) as any).state;

			expect(state.maxSize).toBe(2);
			expect(state.startSize).toBe(2);
			expect(state.autoIncrease).toBe(true);
			expect(state.objectCount).toBe(2);
		});

		it('inserts beyond a capped pool fall back to allocation', () => {
			const pooled = new LinkedList<number>([1, 2, 3, 4], {pool: {maxSize: 2}});

			expect(pooled.values()).toEqual([1, 2, 3, 4]);
			expect(poolOf(pooled)?.size()).toBe(2);
		});

		it('null or invalid pool options use the defaults', () => {
			const withNull = (poolOf(new LinkedList<number>([], {pool: null})) as any).state;
			const withJunk = (poolOf(new LinkedList<number>([], {pool: 'nope' as any})) as any).state;

			expect(withNull.startSize).toBe(0);
			expect(withNull.autoIncrease).toBe(true);
			expect(withJunk.startSize).toBe(0);
			expect(withJunk.autoIncrease).toBe(true);
		});

		it('pool options are ignored when pooling is disabled', () => {
			expect(
				poolOf(new LinkedList<number>([], {disableElementPooling: true, pool: {startSize: 5}}))
			).toBeNull();
		});

		it('filter carries pool options', () => {
			const pooled = new LinkedList<number>([1, 2], {pool: {maxSize: 3}});
			const filtered = pooled.filter(() => true);

			expect((poolOf(filtered) as any).state.maxSize).toBe(3);
		});
	});

	describe('SERIALIZATION', () => {
		it('stringify empty list', () => {
			expect(JSON.parse(list.stringify() as string)).toEqual({type: 'LinkedList', elements: []});
		});

		it('stringify list values head to tail', () => {
			const source = new LinkedList([741, 852]);
			source.insertAtHead(963);

			expect(JSON.parse(source.stringify() as string)).toEqual({
				type: 'LinkedList',
				elements: [963, 741, 852]
			});
		});

		it('stringify returns null for unserializable values', () => {
			const circular: any = {};
			circular.self = circular;
			list.insert(circular);
			expect(list.stringify()).toBeNull();

			list.clearElements();
			list.insert(BigInt(1));
			expect(list.stringify()).toBeNull();
		});

		it('values returns element values head to tail, skipping null', () => {
			const source = new LinkedList([2, 3]);
			source.insertAtHead(1);
			source.tail()?.value(null as any);

			expect(source.values()).toEqual([1, 2]);
			expect(new LinkedList().values()).toEqual([]);
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

		it('rejects null and undefined items with null instead of linking a node', () => {
			const target = new LinkedList<number>();

			expect(target.insert(null as any)).toBeNull();
			expect(target.insert(undefined as any)).toBeNull();
			expect(target.insertAtHead(null as any)).toBeNull();
			expect(target.insertAtHead(undefined as any)).toBeNull();
			expect(target.insertAtTail(null as any)).toBeNull();
			expect(target.insertAtTail(undefined as any)).toBeNull();

			expect(target.size()).toBe(0);
			expect(target.head()).toBeNull();
			expect(target.tail()).toBeNull();
		});

		it('skips null and undefined entries in insertArray and constructor data', () => {
			const target = new LinkedList<string>(['a', null, 'b', undefined] as any);

			expect(target.size()).toBe(2);
			expect(target.values()).toEqual(['a', 'b']);

			target.insertArray(['c', null, undefined] as any);
			expect(target.size()).toBe(3);
			expect(target.values()).toEqual(['a', 'b', 'c']);
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

		it('returns null for a node owned by another list', () => {
			const other = new LinkedList<number>([99]);
			const foreign = other.head();
			const expectedSize = list.size();

			expect(list.removeNode(foreign)).toBeNull();
			expect(list.size()).toBe(expectedSize);
			expect(other.size()).toBe(1);
			expect(other.values()).toEqual([99]);
		});

		it('removeNodes only reports nodes it actually removed', () => {
			const other = new LinkedList<number>([99]);
			const head = list.head()?.value();

			expect(list.removeNodes([other.head(), list.head()])).toEqual([head]);
			expect(other.size()).toBe(1);
		});

		for (const disableElementPooling of [false, true]) {
			it(`clears ownership on removal (pooling disabled: ${disableElementPooling})`, () => {
				const target = new LinkedList<number>([1, 2], {disableElementPooling});
				const removed = target.head() as any;
				const cleared = target.tail() as any;

				target.removeNode(removed);
				target.clearElements();

				for (const node of [removed, cleared]) {
					expect(node._list).toBeNull();
					expect(node._linkId).toBe(0);
					expect(target.removeNode(node)).toBeNull();
				}
			});
		}

		it('removeNodes removes in array order, skips null and repeated nodes', () => {
			const target = new LinkedList<number>([1, 2, 3, 4]);
			const [a, b, c] = target.toArray();

			expect(target.removeNodes([c, null, a, c, b])).toEqual([3, 1, 2]);
			expect(target.values()).toEqual([4]);
			expect(target.removeNodes([])).toEqual([]);
		});

		it('clearElements walks links and builds no array', () => {
			const target = new LinkedList<number>([1, 2, 3]);
			const toArray = jest.spyOn(target, 'toArray');

			target.clearElements();

			expect(toArray).not.toHaveBeenCalled();
			expect(target.head()).toBeNull();
			expect(target.tail()).toBeNull();
			expect(target.size()).toBe(0);
		});

		it('clearElements with pooling disabled unlinks and blanks nodes', () => {
			const target = new LinkedList<number>([1, 2, 3], {disableElementPooling: true});
			const nodes = target.toArray();
			target.clearElements();

			for (const node of nodes) {
				expect(node.next()).toBeNull();
				expect(node.prev()).toBeNull();
				expect(node._list).toBeNull();
			}
			expect(nodes.map((n) => n.value())).toEqual([null, null, null]);
			target.insertArray([7, 8]);
			expect(target.values()).toEqual([7, 8]);
		});

		it('keeps ownership through reverse', () => {
			const target = new LinkedList<number>([1, 2, 3]);
			target.reverse();

			expect(target.removeNode(target.head())).toBe(3);
			expect(target.values()).toEqual([2, 1]);
		});
	});

	describe('ARRAY LIKE USAGE', () => {
		beforeEach(add10Items);

		it('convert to array', () => {
			const result = list.toArray();

			let node = list.head();
			let index = 0;

			while (node != null) {
				expect(node).toBe(result[index]);
				node = node.next();
				index++;
			}
		});

		describe('forEach', () => {
			it('visits every element head to tail with its index', () => {
				const asArray = list.toArray();
				const visited: unknown[] = [];

				list.forEach((e, i) => {
					expect(e).toBe(asArray[i]);
					visited.push(e);
				});

				expect(visited).toEqual(asArray);
			});

			it('passes the list as the third argument', () => {
				list.forEach((_e, _i, l) => {
					expect(l).toBe(list);
				});
			});

			it('binds thisArg as passed, undefined when omitted like Array', () => {
				const custom = {};
				let boundDefault: unknown = null;
				let boundCustom: unknown = null;

				list.forEach(function (this: unknown) {
					// eslint-disable-next-line @typescript-eslint/no-this-alias
					boundDefault = this;
				});
				list.forEach(function (this: unknown) {
					// eslint-disable-next-line @typescript-eslint/no-this-alias
					boundCustom = this;
				}, custom);

				expect(boundDefault).toBeUndefined();
				expect(boundCustom).toBe(custom);
			});

			it('binds falsy thisArg values instead of replacing them', () => {
				const bound: unknown[] = [];
				const single = new LinkedList<number>([1]);

				for (const arg of [0, '', false, null]) {
					single.forEach(function (this: unknown) {
						bound.push(this);
					}, arg);
				}

				expect(bound).toEqual([0, '', false, null]);
			});

			it('returns the list', () => {
				expect(list.forEach(() => {})).toBe(list);
			});

			it('does not call func on an empty list', () => {
				const empty = new LinkedList<number>();
				const func = jest.fn();

				empty.forEach(func);

				expect(func).not.toHaveBeenCalled();
			});

			it('keeps walking when func removes the current element', () => {
				const expected = list.values();
				const visited: unknown[] = [];

				list.forEach((e) => {
					visited.push(e.value());
					list.removeNode(e);
				});

				expect(visited).toEqual(expected);
				expect(list.size()).toBe(0);
			});

			it('keeps walking when func removes the next element', () => {
				const target = new LinkedList<string>(['a', 'b', 'c', 'd']);
				const visited: unknown[] = [];

				target.forEach((e) => {
					visited.push(e.value());
					if (e.value() === 'a') {
						target.removeNode(e.next());
					}
				});

				expect(visited).toEqual(['a', 'c', 'd']);
				expect(target.values()).toEqual(['a', 'c', 'd']);
			});

			it('keeps walking when the removed next element is recycled by an insert', () => {
				const target = new LinkedList<string>(['a', 'b', 'c', 'd']);
				const visited: unknown[] = [];

				target.forEach((e) => {
					visited.push(e.value());
					if (e.value() === 'a') {
						// The pool reissues b's node as the new tail. The walk must
						// not jump there through the stale successor reference.
						target.removeNode(e.next());
						target.insert('e');
					}
				});

				expect(visited).toEqual(['a', 'c', 'd', 'e']);
				expect(target.values()).toEqual(['a', 'c', 'd', 'e']);
			});
		});

		it('filter', () => {
			repeat(5, () => list.insert('random string - ' + Math.random().toString()));

			list.filter((_e, _i, l) => {
				expect(l).toBe(list);
				return true;
			});

			const strings = list.filter((e) => typeof e.value() === 'string', list);
			const numbers = list.filter((e) => typeof e.value() === 'number');

			expect(strings.size()).toBe(5);
			expect(numbers.size()).toBe(10);

			strings.forEach((e) => {
				expect(e.value()).toContain('random string - ');
			});
		});

		it('reverse', () => {
			const asArray = list.toArray();

			expect(list.reverse().toArray()).toEqual(asArray.reverse());

			list.clearElements();
			list.insert(Math.random());
			const singleItem = list.toArray();
			expect(list.reverse().toArray()).toEqual(singleItem.reverse());
		});
	});

	describe('Iterator', () => {
		describe('Iterator on empty linked list', () => {
			it('should not throw when calling iter.next', () => {
				const iter = new LinkedListIterator(list);
				expect(() => {
					iter.next();
				}).not.toThrow();
			});

			it('should return true for done', () => {
				const iter = new LinkedListIterator(list);
				expect(() => {
					const res = iter.next();
					expect(res.done).toBe(true);
				});
			});

			it('should return null for value', () => {
				const iter = new LinkedListIterator(list);
				expect(() => {
					const res = iter.next();
					expect(res.value).toBe(null);
				});
			});
		});

		describe('Iterator on single element linked-list', () => {
			it('should not throw calling iter.next()', () => {
				list.insert('string');
				const iter = new LinkedListIterator(list);
				expect(() => {
					iter.next();
					iter.next();
				}).not.toThrow();
			});

			it('should return null for value', () => {
				list.insert('string');
				const iter = new LinkedListIterator(list);
				expect(() => {
					let res = iter.next();
					res = iter.next();
					expect(res.value).toBe(null);
				});
			});

			it('should return true for done', () => {
				list.insert('string');
				const iter = new LinkedListIterator(list);
				expect(() => {
					let res = iter.next();
					res = iter.next();
					expect(res.done).toBe(true);
				});
			});
		});

		describe('Iterator on linked-list', () => {
			beforeEach(add10Items);
			it('should not throw when using for of', () => {
				const arr: any = [];
				expect(() => {
					for (const item of list) {
						arr.push(item);
					}
				}).not.toThrow();
			});

			it('should not throw when adding to the linkedlist using for of', () => {
				list.insert(20);
				const arr: any = [];
				expect(() => {
					for (const item of list) {
						arr.push(item);
					}
				}).not.toThrow();
				expect(arr.length).toBe(list.size());
				expect(arr[0]).toBe(list.head()?.value());
				expect(arr[arr.length - 1]).toBe(list.tail()?.value());
			});

			it('reuses one result object across next() calls', () => {
				const target = new LinkedList<number>([1, 2]);
				const it = target[Symbol.iterator]();
				const first = it.next();

				expect(first).toEqual({value: 1, done: false});
				expect(it.next()).toBe(first);
				expect(first).toEqual({value: 2, done: false});
				expect(it.next()).toBe(first);
				expect(first).toEqual({value: null, done: true});
				expect([...target]).toEqual([1, 2]);
			});
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

		it('stops calling filters once the limit is reached', () => {
			const target = new LinkedList<number>([1, 2, 3, 4, 5]);
			const filter = jest.fn(() => true);

			expect(target.query(filter, {limit: 2}).length).toBe(2);
			expect(filter).toHaveBeenCalledTimes(2);
		});

		it('matches nothing with an empty filter array', () => {
			expect(new LinkedList<number>([1, 2]).query([])).toEqual([]);
		});

		it('requires every filter in an array and stops at the first failure', () => {
			const target = new LinkedList<number>([1, 2, 3, 4, 5]);
			const second = jest.fn((v: number) => v < 5);
			const results = target.query([(v) => v > 2, second]);

			expect(results.map((r) => r.element.value())).toEqual([3, 4]);
			expect(second).toHaveBeenCalledTimes(3);
		});

		it('keeps matching when a filter removes the next element', () => {
			const target = new LinkedList<number>([1, 2, 3, 4, 5]);

			const results = target.query((v) => {
				if (v === 1) {
					target.removeNode(target.head()?.next() ?? null);
				}
				return v % 2 === 1;
			});

			expect(results.map((r) => r.element.value())).toEqual([1, 3, 5]);
			expect(target.values()).toEqual([1, 3, 4, 5]);
		});

		it('shares key and index functions across results', () => {
			const results = new LinkedList<number>([1, 2, 3]).query(() => true);

			expect(results[0].key).toBe(results[2].key);
			expect(results[0].index).toBe(results[2].index);
			expect(results[2].key()).toBeNull();
			expect(results[2].index()).toBeNull();
		});

		it('rounds a fractional limit and ignores invalid ones', () => {
			const target = new LinkedList<number>([1, 2, 3, 4]);

			expect(target.query(() => true, {limit: 2.4}).length).toBe(2);
			expect(target.query(() => true, {limit: 2.6}).length).toBe(3);
			expect(target.query(() => true, {limit: 0}).length).toBe(4);
			expect(target.query(() => true, {limit: NaN}).length).toBe(4);
			expect(target.query(() => true, {limit: 'x' as any}).length).toBe(4);
		});
	});
});
