import {ObjectPool} from '../../src/object/pool';
import {type ObjectPoolInstance} from '../../src/object/pool/instance';
import {ObjectPoolIterator} from '../../src/object/pool/iterator';
import {type ObjectPoolOptions} from '../../src/object/pool/options';

const repeat = (n: any, f: any) => {
	while (n-- > 0) f(n);
};
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
			const options: Required<Omit<ObjectPoolOptions, 'serializedState'>> = {
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

		it('stringify instance', () => {
			const stringified = instance.stringify();
			expect(new ObjectPool(objectClass, {serializedState: stringified})).toEqual(instance);
		});

		it('with serialized', () => {
			expect(new ObjectPool(objectClass, {serializedState: ''})).toBeInstanceOf(ObjectPool);
			const source = new ObjectPool(objectClass, {increaseFactor: 99});
			const serialized = source.stringify();
			const result = new ObjectPool(objectClass, {serializedState: serialized});
			expect(result).toBeInstanceOf(ObjectPool);
			expect(result).toEqual(source);
		});

		it('invalid', () => {
			expect(() => {
				const result = new ObjectPool(null as any);
				console.log(result);
			}).toThrow();

			expect(() => {
				const options: Required<Omit<ObjectPoolOptions, 'serializedState'>> = {
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

			expect(() => {
				const result = new ObjectPool(objectClass, {serializedState: 'null'});
				console.log(result);
			}).toThrow();

			expect(() => {
				const result = new ObjectPool(objectClass, {serializedState: 'in{valid'});
				console.log(result);
			}).toThrow();

			expect(() => {
				const result = new ObjectPool(objectClass, {serializedState: '{"elements": [4]}'});
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

		it('with zero starting size', () => {
			const zeroStart = new ObjectPool(objectClass, {autoIncrease: true, startSize: 0});
			const result = zeroStart.allocate();
			expect(result).not.toBeNull();
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

			instance.forEach((e, i) => {
				expect(e).toStrictEqual(list[i]);
			});

			list.forEach((e, i) => {
				if (i % 2 === 0) {
					instance.release(e);
					list[i] = null as any;
				}
			});

			list = list.filter((e) => e != null);

			instance.forEach((e, i) => {
				expect(e).toBe(list[i]);
			}, instance);
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
				expect(() => {
					const res = iter.next();
					expect(res.done).toBe(true);
				});
			});

			it('should return null for value', () => {
				const iter = new ObjectPoolIterator(instance);
				expect(() => {
					const res = iter.next();
					expect(res.value).toBe(null);
				});
			});
		});
		describe('Iterator on singleton instance', () => {
			it('should not throw when calling iter.next', () => {
				instance.allocate();
				const iter = new ObjectPoolIterator(instance);
				expect(() => {
					let res = iter.next();
					res = iter.next();
				}).not.toThrow();
			});

			it('should return true for done', () => {
				instance.allocate();
				const iter = new ObjectPoolIterator(instance);
				expect(() => {
					let res = iter.next();
					res = iter.next();
					expect(res.done).toBe(true);
				});
			});

			it('should return null for value', () => {
				instance.allocate();
				const iter = new ObjectPoolIterator(instance);
				expect(() => {
					let res = iter.next();
					res = iter.next();
					expect(res.value).toBe(null);
				});
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
});
