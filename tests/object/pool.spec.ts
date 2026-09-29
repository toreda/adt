import {ObjectPool} from '../../src/object/pool';
import {type ObjectPoolInstance} from '../../src/object/pool/instance';
import {ObjectPoolIterator} from '../../src/object/pool/iterator';
import {type ObjectPoolOptions} from '../../src/object/pool/options';

const add10Items = (p: any) => p.allocateMultiple(10);

class objectClass implements ObjectPoolInstance {
	public state: any;

	constructor() {
		this.cleanObj();
	}

	cleanObj() {
		this.state = {
			atr1: 'big',
			atr2: 'red',
			atr3: 'balloon'
		};
	}
}

describe('ObjectPool', () => {
	let instance: ObjectPool<any>;

	beforeAll(() => {
		instance = new ObjectPool(objectClass, {
			startSize: 1,
			increaseFactor: 2,
			increaseBreakPoint: 1,
			autoIncrease: true
		});
	});

	beforeEach(() => {
		instance.clearElements();
		expect(instance.utilization()).toBe(0);
	});

	describe('INSTANTIATION', () => {
		it('default params', () => {
			const result = new ObjectPool(objectClass);
			expect(result).toBeInstanceOf(ObjectPool);
		});

		it('with options', () => {
			const options: Required<ObjectPoolOptions> = {
				autoIncrease: true,
				increaseFactor: 10,
				increaseBreakPoint: 0.9,
				maxSize: 100000,
				startSize: 100,
				instanceArgs: []
			};
			const result = new ObjectPool(objectClass, options);
			expect(result).toBeInstanceOf(ObjectPool);
		});

		it('stringify returns the config without objects', () => {
			const source = new ObjectPool(objectClass, {increaseFactor: 99, startSize: 3, maxSize: 7});
			source.allocate();

			expect(JSON.parse(source.stringify())).toEqual({
				type: 'ObjectPool',
				autoIncrease: false,
				increaseBreakPoint: 1,
				increaseFactor: 99,
				instanceArgs: [],
				maxSize: 7,
				objectCount: 3,
				startSize: 3
			});
		});

		it('ignores a serializedState option', () => {
			const result = new ObjectPool(objectClass, {serializedState: '{"startSize": 9}'} as any);

			expect(result.state.startSize).toBe(1);
			expect(result.state.objectCount).toBe(1);
		});

		it('invalid', () => {
			expect(() => {
				const result = new ObjectPool(null as any);
				console.log(result);
			}).toThrow();

			expect(() => {
				const options: Required<ObjectPoolOptions> = {
					autoIncrease: 2 as any,
					increaseFactor: 0.7 as any,
					increaseBreakPoint: 1.5,
					maxSize: '0' as any,
					startSize: '100' as any,
					instanceArgs: {} as any
				};
				const result = new ObjectPool(objectClass, options);
				console.log(result);
			}).toThrow();
		});
	});

	describe('ALLOC / RELEASE', () => {
		it('instance manages itself', () => {
			let expectedCount = 0;
			let expectedTotal = 1;

			expectedCount += 1;
			expect(instance.allocate()).toBeInstanceOf(objectClass);
			expect(instance.utilization()).toBeCloseTo(expectedCount / expectedTotal);
			expect(instance.size()).toBe(expectedCount);

			expectedCount += 1;
			expectedTotal *= 2;
			expect(instance.allocate()).toBeInstanceOf(objectClass);
			expect(instance.utilization()).toBeCloseTo(expectedCount / expectedTotal);
			expect(instance.size()).toBe(expectedCount);

			expectedCount += 1;
			expectedTotal *= 2;
			expect(instance.allocate()).toBeInstanceOf(objectClass);
			expect(instance.utilization()).toBeCloseTo(expectedCount / expectedTotal);
			expect(instance.size()).toBe(expectedCount);

			expectedCount += 4;
			expectedTotal *= 2;
			expect(instance.allocateMultiple(4)).toHaveLength(4);
			expect(instance.utilization()).toBeCloseTo(expectedCount / expectedTotal);
			expect(instance.size()).toBe(expectedCount);

			expectedCount -= 1;
			instance.release(instance.map()[0]);
			expect(instance.utilization()).toBeCloseTo(expectedCount / expectedTotal);
			expect(instance.size()).toBe(expectedCount);

			expectedCount += 1;
			expect(instance.allocate()).toBeInstanceOf(objectClass);
			expect(instance.utilization()).toBeCloseTo(expectedCount / expectedTotal);
			expect(instance.size()).toBe(expectedCount);

			expectedCount += 1;
			expect(instance.allocate()).toBeInstanceOf(objectClass);
			expect(instance.utilization()).toBeCloseTo(expectedCount / expectedTotal);
			expect(instance.size()).toBe(expectedCount);

			expectedCount -= 4;
			instance.releaseMultiple(instance.query(() => true, {limit: 4}).map((res) => res.element));
			expect(instance.utilization()).toBeCloseTo(expectedCount / expectedTotal);
			expect(instance.size()).toBe(expectedCount);

			expectedCount += 11;
			expectedTotal *= 2;
			expect(instance.allocateMultiple(11)).toHaveLength(11);
			expect(instance.utilization()).toBeCloseTo(expectedCount / expectedTotal);
			expect(instance.size()).toBe(expectedCount);

			expectedCount += 1;
			expect(instance.allocateMultiple()).toHaveLength(1);
			expect(instance.utilization()).toBeCloseTo(expectedCount / expectedTotal);
			expect(instance.size()).toBe(expectedCount);

			instance.releaseMultiple([{} as any]);
			expect(instance.utilization()).toBeCloseTo(expectedCount / expectedTotal);
			expect(instance.size()).toBe(expectedCount);

			expectedCount -= 4;
			instance.releaseMultiple(instance.query(() => true, {limit: 4}).map((res) => res.element));
			expect(instance.utilization()).toBeCloseTo(expectedCount / expectedTotal);
			expect(instance.size()).toBe(expectedCount);

			expectedCount = 0;
			instance.releaseMultiple(instance.map());
			expect(instance.utilization()).toBeCloseTo(expectedCount / expectedTotal);
			expect(instance.size()).toBe(expectedCount);
		});

		it('tracks used slots across release order and compaction', () => {
			const pool = new ObjectPool(objectClass, {startSize: 0, autoIncrease: true});
			const objects = pool.allocateMultiple(200);
			const kept = objects.filter((_obj, i) => i % 5 === 0);

			// Release from the back and front alternately, forcing compactions.
			const released = objects.filter((_obj, i) => i % 5 !== 0);
			for (let lo = 0, hi = released.length - 1; lo <= hi; lo++, hi--) {
				pool.release(released[hi]);
				if (lo !== hi) {
					pool.release(released[lo]);
				}
			}

			expect(pool.size()).toBe(kept.length);
			expect(new Set(pool.map())).toEqual(new Set(kept));

			for (const obj of kept) {
				const [match] = pool.query((o) => o === obj);
				expect(pool.state.used[match.index() as number]).toBe(obj);
				pool.release(obj);
			}

			expect(pool.size()).toBe(0);
			expect(pool.map()).toEqual([]);
		});

		it('double release does not corrupt used tracking', () => {
			const pool = new ObjectPool(objectClass, {startSize: 0, autoIncrease: true});
			const [a, b] = pool.allocateMultiple(2);

			pool.release(a);
			pool.release(a);

			expect(pool.size()).toBe(1);
			expect(pool.map()[0]).toBe(b);
		});

		it('with zero starting size', () => {
			const zeroStart = new ObjectPool(objectClass, {autoIncrease: true, startSize: 0});
			const result = zeroStart.allocate();
			expect(result).not.toBeNull();
		});

		it('allocateMultiple grows a pool with zero starting size', () => {
			const zeroStart = new ObjectPool(objectClass, {autoIncrease: true, startSize: 0});
			expect(zeroStart.allocateMultiple(3)).toHaveLength(3);
		});

		it('without autoincrease', () => {
			let expectedCount = 0;
			let expectedTotal = 0;
			const manual = new ObjectPool(objectClass, {
				startSize: 0,
				maxSize: 10,
				autoIncrease: false
			});

			expect(manual.allocate()).toBeNull();
			expect(manual.utilization()).toBe(Infinity);
			expect(manual.size()).toBe(expectedCount);

			manual.increaseCapacity(1);
			expectedTotal += 1;
			expect(manual.utilization()).toBeCloseTo(expectedCount / expectedTotal);
			expect(manual.size()).toBe(expectedCount);

			expectedCount += 1;
			expect(manual.allocate()).toBeInstanceOf(objectClass);
			expect(manual.utilization()).toBeCloseTo(expectedCount / expectedTotal);
			expect(manual.size()).toBe(expectedCount);

			expect(manual.allocate()).toBeNull();
			expect(manual.utilization()).toBeCloseTo(expectedCount / expectedTotal);
			expect(manual.size()).toBe(expectedCount);

			expect(manual.allocateMultiple(5)).toStrictEqual([]);
			expect(manual.utilization()).toBeCloseTo(expectedCount / expectedTotal);
			expect(manual.size()).toBe(expectedCount);

			manual.increaseCapacity(8);
			expectedTotal += 8;
			expect(manual.utilization()).toBeCloseTo(expectedCount / expectedTotal);
			expect(manual.size()).toBe(expectedCount);

			expectedCount += 1;
			expect(manual.allocate()).toBeInstanceOf(objectClass);
			expect(manual.utilization()).toBeCloseTo(expectedCount / expectedTotal);
			expect(manual.size()).toBe(expectedCount);

			expectedCount += 7;
			expect(manual.allocateMultiple(99)).toHaveLength(7);
			expect(manual.utilization()).toBeCloseTo(expectedCount / expectedTotal);
			expect(manual.size()).toBe(expectedCount);

			expect(manual.allocate()).toBeNull();
			expect(manual.utilization()).toBeCloseTo(expectedCount / expectedTotal);
			expect(manual.size()).toBe(expectedCount);

			manual.increaseCapacity(99);
			expectedTotal += 1;
			expect(manual.utilization()).toBeCloseTo(expectedCount / expectedTotal);
			expect(manual.size()).toBe(expectedCount);

			expectedCount += 1;
			expect(manual.allocateMultiple(99)).toHaveLength(1);
			expect(manual.utilization()).toBeCloseTo(expectedCount / expectedTotal);
			expect(manual.size()).toBe(expectedCount);

			manual.increaseCapacity(99);
			expect(manual.utilization()).toBeCloseTo(expectedCount / expectedTotal);
			expect(manual.size()).toBe(expectedCount);

			expectedCount = 0;
			expectedTotal = 0;
			manual.reset();
			expect(manual.allocate()).toBeNull();
			expect(manual.utilization()).toBe(Infinity);
			expect(manual.size()).toBe(expectedCount);
		});

		it('ignore non itegers', () => {
			expect(instance.utilization('2.5' as any)).toBeCloseTo(instance.utilization());
			expect(instance.utilization(2.5)).not.toBeCloseTo(instance.utilization());

			expect(instance.allocateMultiple('5.5' as any)).toHaveLength(1);

			const usage = instance.utilization();
			instance.increaseCapacity(11.11);
			expect(instance.utilization()).toBeCloseTo(usage);
			instance.increaseCapacity(11);
			expect(instance.utilization()).not.toBeCloseTo(usage);
		});
	});

	describe('ARRAY LIKE USAGE', () => {
		it('forEach', () => {
			let list = instance.allocateMultiple(43);

			list.forEach((e, i) => {
				e.state.atr1 += i.toString();
			});

			const visited: any[] = [];
			instance.forEach((e, i, arr) => {
				expect(arr[i]).toBe(e);
				visited.push(e);
			});
			expect(visited).toHaveLength(list.length);
			expect(new Set(visited)).toEqual(new Set(list));

			list.forEach((e, i) => {
				if (i % 2 === 0) {
					instance.release(e);
					list[i] = null as any;
				}
			});

			list = list.filter((e) => e != null);

			const after: any[] = [];
			instance.forEach(function (this: any, e) {
				expect(this).toBe(instance);
				after.push(e);
			}, instance);
			expect(after).toHaveLength(list.length);
			expect(new Set(after)).toEqual(new Set(list));
		});

		it('map', () => {
			const list = instance.allocateMultiple(39);

			list.forEach((e, i) => {
				e.state.atr1 += i.toString();
			});

			expect(instance.map()).toStrictEqual(list);

			list.forEach((e, i) => {
				if (i % 2 === 0) {
					instance.release(e);
					list[i] = null as any;
				}
			});

			instance
				.map((e) => e.state.atr2, instance)
				.forEach((e) => {
					expect(e).toBe('red');
				});
		});
	});

	describe('Iterator', () => {
		describe('Iterator for empty pool instance', () => {
			it('should not throw when calling iter.next', () => {
				const iter = new ObjectPoolIterator(instance);
				expect(() => {
					iter.next();
				}).not.toThrow();
			});

			it('should return true for done', () => {
				const iter = new ObjectPoolIterator(instance);
				expect(iter.next().done).toBe(true);
			});

			it('should return null for value', () => {
				const iter = new ObjectPoolIterator(instance);
				expect(iter.next().value).toBe(null);
			});
		});
		describe('Iterator on singleton instance', () => {
			it('should not throw when calling iter.next', () => {
				instance.allocate();
				const iter = new ObjectPoolIterator(instance);
				expect(() => {
					iter.next();
					iter.next();
				}).not.toThrow();
			});

			it('should yield the allocated object first', () => {
				const obj = instance.allocate();
				const iter = new ObjectPoolIterator(instance);
				const res = iter.next();
				expect(res.done).toBe(false);
				expect(res.value).toBe(obj);
			});

			it('should return true for done', () => {
				instance.allocate();
				const iter = new ObjectPoolIterator(instance);
				iter.next();
				expect(iter.next().done).toBe(true);
			});

			it('should return null for value', () => {
				instance.allocate();
				const iter = new ObjectPoolIterator(instance);
				iter.next();
				expect(iter.next().value).toBe(null);
			});
		});
		describe('Iterator on objectinstance', () => {
			it('should not throw when using iterator', () => {
				add10Items(instance);
				const arr: any = [];
				expect(() => {
					for (const item of instance) {
						arr.push(item);
					}
				}).not.toThrow();
			});

			it('should not throw adding element to the object instance using for of', () => {
				add10Items(instance);
				const arr: any = [];
				expect(() => {
					for (const item of instance) {
						arr.push(item);
					}
				}).not.toThrow();
				expect(arr.length).toBe(instance.size());
				expect(arr[0]).toBeInstanceOf(objectClass);
			});
		});
	});

	describe('QUERY', () => {
		beforeEach(() => {
			instance.allocateMultiple(20);
			instance.forEach((e) => {
				e.state = Math.random();
			});
			const list = instance.map();
			instance.releaseMultiple([list[3], null, list[8], list[17]]);
		});

		it('array of matches', () => {
			const above = instance.query((value) => value.state > 0.5);
			const below = instance.query((value) => value.state < 0.5);
			expect(above.length + below.length).toBe(instance.size());
			expect(
				above.every((res) => {
					const value = res.element.state;
					return value > 0.5;
				})
			).toBe(true);
			expect(
				below.every((res) => {
					const value = res.element.state;
					return value < 0.5;
				})
			).toBe(true);
		});

		it('using queries', () => {
			const queryLimit = 2;
			const queries = instance.query([() => true, (v) => !!v], {limit: queryLimit});
			const queryLength = queries.length;
			const instanceSize = instance.size();
			expect(queries.length).toBe(Math.min(instanceSize, queryLimit));

			const queryToDelete = queries[0];
			expect(queryToDelete.key()).toBeNull();
			expect(queryToDelete.index()).not.toBeNull();
			queryToDelete.delete();
			expect(queries.length).toBe(queryLength);
			expect(instance.size()).toBe(instanceSize - 1);
			expect(queryToDelete.index()).toBeNull();
			queryToDelete.delete();
			expect(instance.size()).toBe(instanceSize - 1);
		});
	});

	describe('HOT PATH FIXES', () => {
		class Marked implements ObjectPoolInstance {
			public mark: string | null = null;

			cleanObj(): void {
				this.mark = null;
			}
		}

		describe('allocateMultiple', () => {
			it('returns instead of hanging when the pool is at maxSize', () => {
				const pool = new ObjectPool(Marked, {startSize: 2, maxSize: 2, autoIncrease: true});
				pool.allocate();
				pool.allocate();

				expect(pool.allocateMultiple(1)).toEqual([]);
				expect(pool.state.objectCount).toBe(2);
			});

			it('returns what it can when growth stops at maxSize', () => {
				const pool = new ObjectPool(Marked, {startSize: 1, maxSize: 3, autoIncrease: true});

				expect(pool.allocateMultiple(10)).toHaveLength(3);
				expect(pool.size()).toBe(3);
				expect(pool.state.objectCount).toBe(3);
			});
		});

		describe('release', () => {
			it('returns true for an in-use object', () => {
				const pool = new ObjectPool(Marked, {startSize: 1});
				const obj = pool.allocate() as Marked;
				obj.mark = 'x';

				expect(pool.release(obj)).toBe(true);
				expect(obj.mark).toBeNull();
				expect(pool.size()).toBe(0);
			});

			it('ignores a double release, so one object is never handed out twice', () => {
				const pool = new ObjectPool(Marked, {startSize: 4});
				const a = pool.allocate() as Marked;

				expect(pool.release(a)).toBe(true);
				expect(pool.release(a)).toBe(false);
				expect(pool.state.freeCount).toBe(4);
				expect(pool.state.objectCount).toBe(4);

				const first = pool.allocate();
				const second = pool.allocate();
				expect(first).not.toBe(second);
				expect(pool.size()).toBe(2);
			});

			it('ignores a double release after other objects moved slots', () => {
				const pool = new ObjectPool(Marked, {startSize: 3});
				const [a, b, c] = pool.allocateMultiple(3);

				pool.release(a);
				expect(pool.release(a)).toBe(false);
				expect(pool.size()).toBe(2);
				expect(new Set(pool.map())).toEqual(new Set([b, c]));
			});

			it('ignores a foreign object and leaves it untouched', () => {
				const pool = new ObjectPool(Marked, {startSize: 2, maxSize: 2});
				pool.allocate();
				const foreign = new Marked();
				foreign.mark = 'mine';
				const utilization = pool.utilization();

				expect(pool.release(foreign)).toBe(false);
				expect(foreign.mark).toBe('mine');
				expect(pool.size()).toBe(1);
				expect(pool.state.freeCount).toBe(1);
				expect(pool.state.objectCount).toBe(2);
				expect(pool.utilization()).toBe(utilization);
				expect(pool.allocate()).not.toBe(foreign);
			});

			it('ignores an object that belongs to another pool', () => {
				const pool = new ObjectPool(Marked, {startSize: 2});
				const other = new ObjectPool(Marked, {startSize: 2});
				pool.allocate();
				const theirs = other.allocate() as Marked;
				theirs.mark = 'theirs';

				expect(pool.release(theirs)).toBe(false);
				expect(theirs.mark).toBe('theirs');
				expect(pool.size()).toBe(1);
				expect(other.size()).toBe(1);
			});

			it('ignores null, undefined, and non-pool values', () => {
				const pool = new ObjectPool(Marked, {startSize: 1});
				pool.allocate();

				expect(pool.release(null as any)).toBe(false);
				expect(pool.release(undefined as any)).toBe(false);
				expect(pool.release({} as any)).toBe(false);
				expect(pool.size()).toBe(1);
			});

			it('never grows the pool past maxSize through repeated foreign releases', () => {
				const pool = new ObjectPool(Marked, {startSize: 2, maxSize: 2});

				for (let i = 0; i < 10; i++) {
					pool.release(new Marked());
				}

				expect(pool.state.freeCount).toBe(2);
				expect(pool.state.objectCount).toBe(2);
				expect(pool.utilization()).toBe(0);
			});

			it('keeps every in-use slot correct through swap-remove', () => {
				const pool = new ObjectPool(Marked, {startSize: 50, maxSize: 50});
				const objects = pool.allocateMultiple(50);
				const kept = new Set(objects);

				for (let i = 0; i < objects.length; i += 3) {
					pool.release(objects[i]);
					kept.delete(objects[i]);
				}

				expect(pool.size()).toBe(kept.size);
				for (const obj of kept) {
					const [match] = pool.query((o) => o === obj);
					expect(pool.state.used[match.index() as number]).toBe(obj);
				}
				for (let i = pool.size(); i < pool.state.used.length; i++) {
					expect(pool.state.used[i]).toBeNull();
				}
			});

			it('keeps its arrays the same length in an allocate and release loop', () => {
				const pool = new ObjectPool(Marked, {startSize: 8, maxSize: 8});
				const held = pool.allocateMultiple(4);
				const usedLength = pool.state.used.length;
				const poolLength = pool.state.pool.length;

				for (let i = 0; i < 1000; i++) {
					pool.release(held[i % 4]);
					held[i % 4] = pool.allocate() as Marked;
				}

				expect(pool.size()).toBe(4);
				expect(pool.state.used.length).toBe(usedLength);
				expect(pool.state.pool.length).toBe(poolLength);
				expect(new Set(pool.map())).toEqual(new Set(held));
			});

			it('keeps its slot key out of the object keys and JSON', () => {
				const pool = new ObjectPool(Marked, {startSize: 1});
				const obj = pool.allocate() as Marked;

				expect(Object.keys(obj)).toEqual(['mark']);
				expect(JSON.stringify(obj)).toBe('{"mark":null}');
			});
		});

		describe('releaseMultiple', () => {
			it('skips nulls, foreign objects, and duplicates', () => {
				const pool = new ObjectPool(Marked, {startSize: 3, maxSize: 3});
				const [a, b] = pool.allocateMultiple(2);

				pool.releaseMultiple([a, null, new Marked(), a, b, b]);

				expect(pool.size()).toBe(0);
				expect(pool.state.freeCount).toBe(3);
				expect(pool.state.objectCount).toBe(3);
			});
		});

		describe('iterator', () => {
			it('yields the in-use objects, not the free ones', () => {
				const pool = new ObjectPool(Marked, {startSize: 5});
				const [a, b] = pool.allocateMultiple(2);
				a.mark = 'a';
				b.mark = 'b';

				const seen: Marked[] = [];
				for (const obj of pool) {
					seen.push(obj as Marked);
				}

				expect(seen).toHaveLength(2);
				expect(new Set(seen)).toEqual(new Set([a, b]));

				pool.release(a);
				const after: Marked[] = [];
				for (const obj of pool) {
					after.push(obj as Marked);
				}
				expect(after).toEqual([b]);
			});

			it('reuses one result object per iterator', () => {
				const pool = new ObjectPool(Marked, {startSize: 2});
				pool.allocateMultiple(2);
				const iter = new ObjectPoolIterator(pool);

				const first = iter.next();
				const second = iter.next();
				const end = iter.next();

				expect(second).toBe(first);
				expect(end).toBe(first);
				expect(end.done).toBe(true);
				expect(end.value).toBeNull();
			});
		});

		describe('forEach', () => {
			it('passes the in-use array, not the free list', () => {
				const pool = new ObjectPool(Marked, {startSize: 4});
				pool.allocateMultiple(2);
				let calls = 0;

				pool.forEach((obj, i, arr) => {
					calls++;
					expect(arr).toBe(pool.state.used);
					expect(arr[i]).toBe(obj);
				});

				expect(calls).toBe(2);
			});

			it('allows releasing the visited object, visiting each object once', () => {
				const pool = new ObjectPool(Marked, {startSize: 10});
				const objects = pool.allocateMultiple(10);
				const visited: Marked[] = [];

				pool.forEach((obj) => {
					visited.push(obj);
					if (objects.indexOf(obj) % 2 === 0) {
						pool.release(obj);
					}
				});

				expect(visited).toHaveLength(10);
				expect(new Set(visited)).toEqual(new Set(objects));
				expect(pool.size()).toBe(5);
			});

			it('stops at the in-use range when the callback releases several objects', () => {
				const pool = new ObjectPool(Marked, {startSize: 4});
				pool.allocateMultiple(4);
				let calls = 0;

				pool.forEach(() => {
					calls++;
					pool.clearElements();
				});

				expect(calls).toBe(1);
			});
		});

		describe('map', () => {
			it('passes each object with its slot', () => {
				const pool = new ObjectPool(Marked, {startSize: 3});
				pool.allocateMultiple(3);

				expect(pool.map((obj, i, arr) => arr[i] === obj)).toEqual([true, true, true]);
			});
		});

		describe('query', () => {
			it('stops at the limit', () => {
				const pool = new ObjectPool(Marked, {startSize: 10});
				pool.allocateMultiple(10);
				let calls = 0;

				const results = pool.query(
					() => {
						calls++;
						return true;
					},
					{limit: 3}
				);

				expect(results).toHaveLength(3);
				expect(calls).toBe(3);
			});

			it('requires every filter in an array to match', () => {
				const pool = new ObjectPool(Marked, {startSize: 3});
				const [a, b, c] = pool.allocateMultiple(3);
				a.mark = 'x';
				b.mark = 'y';
				c.mark = 'x';

				const results = pool.query([(o) => o.mark !== null, (o) => o.mark === 'x']);

				expect(new Set(results.map((r) => r.element))).toEqual(new Set([a, c]));
				expect(pool.query([])).toEqual([]);
			});

			it('delete returns null once the object is released', () => {
				const pool = new ObjectPool(Marked, {startSize: 2});
				const obj = pool.allocate() as Marked;
				const [match] = pool.query((o) => o === obj);

				expect(match.delete()).toBe(obj);
				expect(match.index()).toBeNull();
				expect(match.delete()).toBeNull();
				expect(pool.size()).toBe(0);
			});
		});

		describe('clearElements', () => {
			it('returns every in-use object to the free list, cleaned', () => {
				const pool = new ObjectPool(Marked, {startSize: 5});
				const objects = pool.allocateMultiple(5);
				objects.forEach((o) => (o.mark = 'x'));

				pool.clearElements();

				expect(pool.size()).toBe(0);
				expect(pool.state.freeCount).toBe(5);
				expect(pool.state.objectCount).toBe(5);
				expect(objects.every((o) => o.mark === null)).toBe(true);
				expect(pool.state.used.every((o) => o === null)).toBe(true);
			});

			it('makes a later release of a cleared object a no-op', () => {
				const pool = new ObjectPool(Marked, {startSize: 2, maxSize: 2});
				const obj = pool.allocate() as Marked;
				pool.clearElements();

				expect(pool.release(obj)).toBe(false);
				expect(pool.state.freeCount).toBe(2);
			});
		});

		describe('reset', () => {
			it('ignores later releases of objects allocated before the reset', () => {
				const pool = new ObjectPool(Marked, {startSize: 2, maxSize: 4, autoIncrease: true});
				const held = pool.allocateMultiple(4);
				pool.reset();

				held.forEach((o) => expect(pool.release(o)).toBe(false));
				expect(pool.state.objectCount).toBe(2);
				expect(pool.state.freeCount).toBe(2);
				expect(pool.utilization()).toBe(0);
			});

			it('shrinks to startSize by reusing existing objects', () => {
				const pool = new ObjectPool(Marked, {startSize: 2, maxSize: 8, autoIncrease: true});
				const held = pool.allocateMultiple(8);
				pool.reset();

				expect(pool.state.objectCount).toBe(2);
				expect(pool.state.pool).toHaveLength(2);
				expect(pool.state.used).toHaveLength(0);
				expect(held).toContain(pool.allocate());
			});

			it('refills to startSize when the pool had fewer objects', () => {
				const pool = new ObjectPool(Marked, {startSize: 0, autoIncrease: false});
				pool.state.startSize = 3;
				pool.reset();

				expect(pool.state.objectCount).toBe(3);
				expect(pool.state.freeCount).toBe(3);
			});
		});
	});
});
