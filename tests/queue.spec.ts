import ADTQueryFilter from '../src/query/query-filter';
import ADTQueryOptions from '../src/query/query-options';
import ADTQueryResult from '../src/query/query-result';
import ADTQueue from '../src/queue/queue';
import ADTQueueState from '../src/queue/queue-state';

describe('ADTQueue', () => {
	const FALSY_NAN_VALUES = [null, undefined, '', NaN];
	const TRUTHY_NAN_VALUES = ['1.5', '-1', '0', '1', '1.5'];
	const NAN_VALUES = ([] as any[]).concat(FALSY_NAN_VALUES, TRUTHY_NAN_VALUES);

	const NEG_FLOAT_VALUES = [-9.9, -0.5];
	const POS_FLOAT_VALUES = [0.5, 9.9];
	const FLOAT_VALUES = ([] as any[]).concat(NEG_FLOAT_VALUES, POS_FLOAT_VALUES);

	const NEG_INT_VALUES = [-1, -10];
	const POS_INT_VALUES = [1, 10];
	const INT_VALUES = ([0] as any[]).concat(NEG_INT_VALUES, POS_INT_VALUES);

	const NEG_NUM_VALUES = ([] as any[]).concat(NEG_INT_VALUES, NEG_FLOAT_VALUES);
	const POS_NUM_VALUES = ([] as any[]).concat(POS_INT_VALUES, POS_FLOAT_VALUES);
	const NUM_VALUES = ([0] as any[]).concat(NEG_NUM_VALUES, POS_NUM_VALUES);

	const STATE_PROPERTIES = ['type', 'elements', 'deepClone', 'objectPool'];
	const VALID_SERIALIZED_STATE = [
		'{',
		'"type": "qState",',
		'"elements": [],',
		'"deepClone": true,',
		'"objectPool": true',
		'}'
	].join('');
	const DEFAULT_STATE: ADTQueueState<number> = {
		type: 'qState',
		elements: [],
		deepClone: false,
		objectPool: false
	};

	const ITEMS = [90, 70, 50, 30, 10, 80, 60, 40, 20];

	const isValidStateRuns = function (action: Function) {
		it('should run isValidState check', () => {
			const custom: ADTQueue<number> = new ADTQueue<number>();
			const spy = jest.spyOn(custom, 'isValidState');
			spy.mockClear();
			custom.state.type = '' as any;
			action(custom);
			expect(spy).toBeCalled();
		});
	};
	const queryFilter = function (target: number): ADTQueryFilter {
		const filter: ADTQueryFilter = (element): boolean => {
			return element === target;
		};

		return filter;
	};

	let instance: ADTQueue<number>;

	beforeAll(() => {
		instance = new ADTQueue<number>();
	});

	beforeEach(() => {
		instance.reset();
	});

	describe('Constructor', () => {
		describe('constructor', () => {
			it('should initialize empty queue', () => {
				const custom = new ADTQueue<number>();
				expect(custom.size()).toBe(0);
			});

			it('should initialize with serializedState', () => {
				const custom = new ADTQueue<number>({serializedState: VALID_SERIALIZED_STATE});
				expect(JSON.parse(custom.stringify()!)).toStrictEqual(JSON.parse(VALID_SERIALIZED_STATE));
			});

			it('should initialize with other options overriding serializedState if they are valid', () => {
				const expectedV: ADTQueueState<number> = JSON.parse(VALID_SERIALIZED_STATE);
				expectedV.elements = [3, 4];

				const custom = new ADTQueue<number>({
					serializedState: VALID_SERIALIZED_STATE,
					elements: expectedV.elements,
					objectPool: 0 as any
				});

				expect(JSON.parse(custom.stringify()!)).toStrictEqual(expectedV);
			});
		});

		describe('parseOptions', () => {
			it('should return default properties if options is falsey', () => {
				expect(instance.parseOptions()).toStrictEqual(DEFAULT_STATE);
				expect(instance.parseOptions(null!)).toStrictEqual(DEFAULT_STATE);
				expect(instance.parseOptions(undefined!)).toStrictEqual(DEFAULT_STATE);
				expect(instance.parseOptions({} as any)).toStrictEqual(DEFAULT_STATE);
			});

			it('should return properties from parsed options', () => {
				const expectedV = JSON.parse(VALID_SERIALIZED_STATE);

				expect(
					instance.parseOptions({
						serializedState: VALID_SERIALIZED_STATE
					})
				).toStrictEqual(expectedV);

				expectedV.elements = [3, 4];
				expectedV.deepClone = false;
				expectedV.objectPool = false;

				expect(
					instance.parseOptions({
						serializedState: VALID_SERIALIZED_STATE,
						elements: expectedV.elements,
						deepClone: expectedV.deepClone,
						objectPool: expectedV.objectPool
					})
				).toStrictEqual(expectedV);
			});
		});

		describe('parseOptionsState', () => {
			it('should return the default state if options is falsey', () => {
				expect(instance.parseOptionsState(null!)).toStrictEqual(DEFAULT_STATE);
				expect(instance.parseOptionsState('' as any)).toStrictEqual(DEFAULT_STATE);
				expect(instance.parseOptionsState(undefined!)).toStrictEqual(DEFAULT_STATE);
			});

			it.each(STATE_PROPERTIES)('should throw when state.%s is null', (myTest) => {
				const state = {...DEFAULT_STATE};
				state[myTest] = null!;
				const errors = instance.getStateErrors(state);

				expect(() => {
					instance.parseOptionsState({
						serializedState: JSON.stringify(state)
					});
				}).toThrow(errors.join('\n'));
			});

			it('should return serializedState as ADTQueueState if it is valid', () => {
				const expected = JSON.parse(VALID_SERIALIZED_STATE);
				expect(
					instance.parseOptionsState({
						serializedState: VALID_SERIALIZED_STATE
					})
				).toStrictEqual(expected);
			});
		});

		describe('parseOptionsStateString', () => {
			it('should return null if argument is not a string with length > 0', () => {
				expect(instance.parseOptionsStateString(4 as any)).toBeNull();
				expect(instance.parseOptionsStateString([] as any)).toBeNull();
				expect(instance.parseOptionsStateString({} as any)).toBeNull();
				expect(instance.parseOptionsStateString('' as any)).toBeNull();
				expect(instance.parseOptionsStateString(false as any)).toBeNull();
			});

			it('should return array of errors if string cant be parsed', () => {
				expect(instance.parseOptionsStateString('[4,3,')).toContain('Unexpected end of JSON input');
				expect(instance.parseOptionsStateString('{left:f,right:')).toContain(
					'Unexpected token l in JSON at position 1'
				);
			});

			const toParseList = ['{}', '{"type": "qState"}', '{"elements":4, "type": "qState"}'];
			it.each(toParseList)('should return errors, %p wont parse into an ADTQueueState', (toParse) => {
				let errors: Array<string> = [];
				errors = instance.getStateErrors(JSON.parse(toParse) as any);
				errors.unshift('state is not a valid ADTQueueState');
				expect(instance.parseOptionsStateString(toParse)).toStrictEqual(errors);
			});

			it('should return an ADTQueueState when a parsable string is passed', () => {
				const expectedV = JSON.parse(VALID_SERIALIZED_STATE);
				expect(instance.parseOptionsStateString(VALID_SERIALIZED_STATE)).toStrictEqual(expectedV);
			});
		});

		describe('parseOptionsOther', () => {
			it('should return the default state if state is falsey', () => {
				expect(instance.parseOptionsOther(null!)).toStrictEqual(DEFAULT_STATE);
				expect(instance.parseOptionsOther('' as any)).toStrictEqual(DEFAULT_STATE);
				expect(instance.parseOptionsOther(undefined!)).toStrictEqual(DEFAULT_STATE);
			});

			it('should return passed state if options is null or undefined', () => {
				const testSuite = [null, undefined];
				testSuite.forEach((myTest) => {
					expect(instance.parseOptionsOther(instance.state, myTest!)).toStrictEqual(instance.state);
					expect(instance.parseOptionsOther(DEFAULT_STATE, myTest!)).toStrictEqual(DEFAULT_STATE);

					const expectedV = JSON.parse(VALID_SERIALIZED_STATE);
					expect(instance.parseOptionsOther(expectedV as any, myTest!)).toStrictEqual(expectedV);
				});
			});

			it('should return passed state with values changed to match other passed options if those are valid', () => {
				const expectedV: ADTQueueState<number> = {...DEFAULT_STATE};
				expectedV.elements = [3, 4];

				const result = instance.parseOptionsOther(
					{...DEFAULT_STATE},
					{
						elements: expectedV.elements,
						objectPool: 0 as any
					}
				);

				expect(result).toStrictEqual(expectedV);
			});
		});
	});

	describe('Helpers', () => {
		describe('getDefaultState', () => {
			it('should return the default state', () => {
				expect(instance.getDefaultState()).toStrictEqual(DEFAULT_STATE);
			});
		});

		describe('getStateErrors', () => {
			it('should return an empty array if state is valid', () => {
				expect(instance.getStateErrors(DEFAULT_STATE)).toStrictEqual([]);
			});

			let testSuite = [null, undefined, '', 0];
			it.each(testSuite)('should return errors if state is %p', (myTest) => {
				const expectedV = 'state is null or undefined';
				const errors = instance.getStateErrors(myTest as any);

				expect(Array.isArray(errors)).toBe(true);
				expect(errors).toContain(expectedV);
			});

			let stateTestSuiteObj: Array<{prop: string; result: string; testSuite: any[]; expectedV: string}> = [
				{
					prop: 'type',
					result: 'not "qState"',
					testSuite: ([] as any).concat([null, undefined, '', 'state']),
					expectedV: 'state type must be qState'
				},
				{
					prop: 'elements',
					result: 'not an array',
					testSuite: ([] as any).concat([{}, null, undefined, '', 'teststring']),
					expectedV: 'state elements must be an array'
				},
				{
					prop: 'deepClone',
					result: 'not a boolean',
					testSuite: ([] as any).concat([{}, '', 'true', 'false', 0, 1, null, undefined]),
					expectedV: 'state deepClone must be a boolean'
				},
				{
					prop: 'objectPool',
					result: 'not a boolean',
					testSuite: ([] as any).concat([{}, '', 'true', 'false', 0, 1, null, undefined]),
					expectedV: 'state objectPool must be a boolean'
				}
			];
			let stateTestSuite: Array<any[]> = stateTestSuiteObj.map((elem) => {
				return [elem.prop, elem.result, elem.testSuite, elem.expectedV];
			});

			describe.each(stateTestSuite)(
				'should return errors, state.%s is %s',
				(prop, result, myTests, expectedV) => {
					it.each(myTests)(`state.${prop} is %p`, (myTest) => {
						const state = {...DEFAULT_STATE};
						state[prop] = myTest as any;
						const errors = instance.getStateErrors(state);

						expect(Array.isArray(errors)).toBe(true);
						expect(errors).toContain(expectedV);
					});
				}
			);
		});

		describe('isValidState', () => {
			it('should return true if state is a valid ADTQueueState', () => {
				expect(instance.isValidState(instance.state)).toBe(true);
			});

			it('should return false if state is null or undefined', () => {
				const testSuite = [null, undefined];
				testSuite.forEach((myTest) => {
					expect(instance.isValidState(myTest!)).toBe(false);
				});
			});

			it.each(STATE_PROPERTIES)('should return false if a state state.%s is not valid', (myTest) => {
				const state = {...DEFAULT_STATE};
				state[myTest] = null!;
				expect(instance.isValidState(state)).toBe(false);
			});
		});

		describe('queryDelete', () => {
			let queryResult: ADTQueryResult<number>;

			beforeEach(() => {
				ITEMS.forEach((item) => {
					instance.push(item);
				});
			});

			afterEach(() => {
				instance.clearElements();
				queryResult = null as any;
			});

			it('should return null if arg does not have an index method', () => {
				expect(instance.queryDelete({} as any)).toBeNull();
			});

			it('should return null if index is null', () => {
				let expectedSize = ITEMS.length;
				expect(instance.size()).toBe(expectedSize);

				let queryResults = instance.query(queryFilter(instance.front()!));
				expect(queryResults.length).toBe(1);
				queryResult = queryResults[0];

				let spy = jest.spyOn(queryResult, 'index').mockImplementation(() => {
					return null;
				});

				expect(instance.queryDelete(queryResult)).toBeNull();
				expect(instance.size()).toBe(expectedSize);

				spy.mockRestore();
			});

			it('should return element if it is in queue', () => {
				let expectedSize = ITEMS.length;
				expect(instance.size()).toBe(expectedSize);

				let queryResults = instance.query(queryFilter(instance.front()!));
				expect(queryResults.length).toBe(1);
				queryResult = queryResults[0];

				expect(instance.queryDelete(queryResult)).toBe(queryResult.element);
			});

			it('should delete the element from queue', () => {
				let expectedSize = ITEMS.length;
				expect(instance.size()).toBe(expectedSize);

				let queryResults = instance.query(queryFilter(instance.front()!));
				expect(queryResults.length).toBe(1);
				queryResult = queryResults[0];

				instance.queryDelete(queryResult);
				expect(instance.size()).toBe(expectedSize - 1);
			});
		});

		describe('queryIndex', () => {
			let queryResult: ADTQueryResult<number>;

			beforeEach(() => {
				ITEMS.forEach((item) => {
					instance.push(item);
				});
			});

			afterEach(() => {
				instance.clearElements();
				queryResult = null as any;
			});

			it('should return null if element is not in queue', () => {
				let expectedSize = ITEMS.length;
				expect(instance.size()).toBe(expectedSize);

				let queryResults = instance.query(queryFilter(instance.front()!));
				queryResult = queryResults[0];

				queryResult.delete();
				expect(queryResult.index()).toBeNull();
			});
		});

		describe('queryOptions', () => {
			const DEFAULT_OPTS = {
				limit: Infinity
			};
			it('should return ADTQueryOptions with all properties', () => {
				const props = ['limit'];
				let opts1 = instance.queryOptions();
				let opts2 = instance.queryOptions({});
				let opts3 = instance.queryOptions({limit: 99});
				let opts4 = instance.queryOptions({limit: '99' as any});

				props.forEach((prop) => {
					expect(opts1[prop]).not.toBeUndefined();
					expect(opts2[prop]).not.toBeUndefined();
					expect(opts3[prop]).not.toBeUndefined();
					expect(opts4[prop]).not.toBeUndefined();
				});
			});

			it('should return default if opts is null or underfined', () => {
				expect(instance.queryOptions()).toStrictEqual(DEFAULT_OPTS);
				expect(instance.queryOptions(null!)).toStrictEqual(DEFAULT_OPTS);
				expect(instance.queryOptions(undefined!)).toStrictEqual(DEFAULT_OPTS);
			});

			it('should return default with passed props overridden', () => {
				let expectedV = {...DEFAULT_OPTS};
				let opts: ADTQueryOptions = {};
				expect(instance.queryOptions({})).toStrictEqual(expectedV);

				const limit = 5;
				opts.limit = limit;
				expectedV.limit = limit;
				expect(instance.queryOptions(opts)).toStrictEqual(expectedV);

				const limitFloat = 5.7;
				opts.limit = limitFloat;
				expectedV.limit = Math.round(limitFloat);
				expect(instance.queryOptions(opts)).toStrictEqual(expectedV);
			});

			let testSuite = ([0] as any).concat(NAN_VALUES, NEG_NUM_VALUES);
			it.each(testSuite)('should ignore limit = %p, not a number >= 1', (myTest) => {
				let opts = {limit: myTest as any};
				expect(instance.queryOptions(opts)).toStrictEqual(DEFAULT_OPTS);
			});
		});
	});

	describe('Implementation', () => {
		describe('clearElements', () => {
			it('should not throw when queue is empty', () => {
				expect(instance.size()).toBe(0);
				expect(() => {
					instance.reset();
				}).not.toThrow();
			});

			it('should remove all items from queue', () => {
				instance.push(1);
				instance.push(2);
				instance.pop();

				expect(instance.size()).not.toBe(0);

				instance.clearElements();

				expect(instance.size()).toBe(0);
			});

			it('should not change any other state variables', () => {
				const custom = new ADTQueue<number>();

				custom.state.type = 'test' as any;
				custom.state.deepClone = 'test' as any;
				custom.state.objectPool = 'test' as any;

				custom.clearElements();

				expect(custom.state.type).toBe('test');
				expect(custom.state.deepClone).toBe('test');
				expect(custom.state.objectPool).toBe('test');
			});
		});

		describe('forEach', () => {
			let testSuite = [
				[['push']],
				[['push', 'push']],
				[['push', 'push', 'pop']],
				[['push', 'push', 'pop', 'push', 'push', 'push', 'push']]
			];
			it.each(testSuite)('should loop through all after %p', (myTest) => {
				let pushCount = 0;
				myTest.forEach((func) => {
					if (func === 'push') {
						pushCount++;
						instance[func](pushCount);
					} else {
						instance[func]();
					}
				});

				let expectedV = myTest.join('');
				let expectedCount = instance.size();
				let count = 0;
				instance.forEach((elem, index) => {
					count++;
					instance.state.elements[index] = expectedV as any;
				});
				expect(count).toBe(expectedCount);
				expect(instance.front()).toBe(expectedV);
			});
		});

		describe('front', () => {
			it('should return null when queue is empty', () => {
				expect(instance.size()).toBe(0);
				expect(instance.front()).toBeNull();
			});

			it('should return the first queued element', () => {
				const expectedV = 1049;
				instance.push(expectedV);
				expect(instance.front()).toBe(expectedV);
				instance.push(2029);
				expect(instance.front()).toBe(expectedV);
			});
		});

		describe('isEmpty', () => {
			it('should return true when queue has no items', () => {
				instance.clearElements();
				expect(instance.size()).toBe(0);
				expect(instance.isEmpty()).toBe(true);
			});

			it('should return false when queue has exactly 1 item', () => {
				expect(instance.size()).toBe(0);
				instance.push(1);
				expect(instance.isEmpty()).toBe(false);
			});

			it('should return false when queue has multiple items', () => {
				instance.push(1);
				instance.push(44);
				instance.push(941);
				expect(instance.isEmpty()).toBe(false);
			});
		});

		describe('pop', () => {
			it('should remove exactly 1 item from queue when pop is called once', () => {
				const limit = 12;
				for (let i = 0; i < limit; i++) {
					instance.push(Math.floor(Math.random() * 191919));
				}
				expect(instance.size()).toBe(limit);
				instance.pop();
				expect(instance.size()).toBe(limit - 1);
			});

			it('should not throw when called on an empty queue', () => {
				expect(instance.size()).toBe(0);
				expect(() => {
					instance.pop();
				}).not.toThrow();
			});

			it('should return null when called on an empty queue', () => {
				expect(instance.size()).toBe(0);
				expect(instance.pop()).toBeNull();
			});

			it('should return the first item in queue', () => {
				const limit = 18;
				const expectedResult = 9841191;

				instance.push(expectedResult);

				for (let i = 0; i < limit; i++) {
					instance.push(Math.floor(Math.random() * 191919));
				}

				expect(instance.pop()).toBe(expectedResult);
			});

			it('should pop each item in the order it was added', () => {
				const items = [1, 3, 5, 7, 2, 4, 6];

				items.forEach((item: number) => {
					instance.push(item);
				});

				for (let i = 0; i < items.length; i++) {
					const result = instance.pop();
					expect(result).toBe(items[i]);
				}
			});

			it('should return null when called after queue is empty', () => {
				const items = [1, 2, 3, 4, 5, 6, 7];

				items.forEach((item: number) => {
					instance.push(item);
				});

				for (let i = 0; i < items.length; i++) {
					const result = instance.pop();
					expect(result).toBe(items[i]);
				}

				expect(instance.pop()).toBeNull();
			});

			it('should return null when called on empty queue repeatedly', () => {
				expect(instance.size()).toBe(0);

				for (let i = 0; i < 5; i++) {
					expect(instance.pop()).toBeNull();
				}
			});
		});

		describe('push', () => {
			it('should add exactly one item to queue when push is called once', () => {
				expect(instance.size()).toBe(0);
				instance.push(14);
				expect(instance.size()).toBe(1);
			});

			it('should add exactly 15 items to queue when push is called 15 times', () => {
				expect(instance.size()).toBe(0);

				const limit = 15;
				for (let i = 0; i < limit; i++) {
					instance.push(Math.floor(Math.random() * 191919));
				}

				expect(instance.size()).toBe(limit);
			});
		});

		describe('query', () => {
			let spyOpts: jest.SpyInstance;
			let defOpts: Required<ADTQueryOptions>;

			beforeAll(() => {
				spyOpts = jest.spyOn(instance, 'queryOptions');
				defOpts = instance.queryOptions();
			});

			beforeEach(() => {
				ITEMS.forEach((item) => {
					instance.push(item);
				});
				spyOpts.mockReset();
				spyOpts.mockReturnValue(defOpts);
			});

			afterEach(() => {
				instance.clearElements();
			});

			afterAll(() => {
				spyOpts.mockRestore();
			});

			it('should call queryOptions once', () => {
				let expectedCalls = 0;
				expect(spyOpts).toBeCalledTimes(expectedCalls);

				instance.query([]);
				expectedCalls++;
				expect(spyOpts).toBeCalledTimes(expectedCalls);

				instance.query(queryFilter(10));
				expectedCalls++;
				expect(spyOpts).toBeCalledTimes(expectedCalls);

				instance.query([queryFilter(10)]);
				expectedCalls++;
				expect(spyOpts).toBeCalledTimes(expectedCalls);
			});

			it('should return empty array if no filters are given', () => {
				let expectedSize = ITEMS.length;
				expect(instance.size()).toBe(expectedSize);
				expect(instance.query([])).toEqual([]);
			});

			it('should return all elements matching filter', () => {
				let expectedSize = ITEMS.length;
				expect(instance.size()).toBe(expectedSize);
				let query = 15;
				expect(instance.query(queryFilter(query)).length).toBe(0);

				let expectedV = 3;
				for (let i = 0; i < expectedV; i++) {
					instance.push(query);
				}

				expect(instance.query(queryFilter(query)).length).toBe(expectedV);
			});

			it('should return all elements matching filter up to limit', () => {
				let expectedSize = ITEMS.length;
				expect(instance.size()).toBe(expectedSize);
				let query = 45;
				expect(instance.query(queryFilter(query)).length).toBe(0);

				let expectedV = 2;
				for (let i = 0; i < expectedV * 2; i++) {
					instance.push(query);
				}

				spyOpts.mockReturnValue({limit: expectedV});
				expect(instance.query(queryFilter(query)).length).toBe(expectedV);
			});

			it('should return elements that match all filters', () => {
				const customFilter = function (target: number, lessthan: boolean): ADTQueryFilter {
					const filter: ADTQueryFilter = (element): boolean => {
						if (lessthan) {
							return element < target;
						} else {
							return element > target;
						}
					};

					return filter;
				};
				instance.clearElements();
				ITEMS.forEach((item) => {
					instance.push(item);
				});

				let result = instance.query([customFilter(60, true), customFilter(30, false)]);
				expect(result.length).toBe(2);
				let resultValues: number[] = [];
				result.forEach((res) => {
					resultValues.push(res.element);
				});
				resultValues.sort((a, b) => a - b);
				expect(resultValues).toEqual([40, 50]);
			});
		});

		describe('reset', () => {
			it('should not throw when state has errors', () => {
				instance.state.type = '' as any;
				expect(() => {
					instance.reset();
				}).not.toThrow();
			});

			it('should return the cq', () => {
				expect(instance.reset()).toBe(instance);
			});

			it('should call clearElements', () => {
				const spy = jest.spyOn(instance, 'clearElements');
				expect(spy).not.toBeCalled();

				instance.reset();
				expect(spy).toBeCalled();
			});

			it('should remove all data from queue', () => {
				const custom = new ADTQueue<number>();

				custom.state.type = 'test' as any;
				custom.state.deepClone = 'test' as any;
				custom.state.objectPool = 'test' as any;

				custom.reset();

				expect(custom.state.type).toBe('qState');
				expect(custom.state.deepClone).toBe('test');
				expect(custom.state.objectPool).toBe('test');
			});
		});

		describe('reverse', () => {
			it('should not throw when queue is empty', () => {
				expect(instance.size()).toBe(0);
				expect(() => {
					instance.reverse();
				}).not.toThrow();
			});

			it('should not affect queue with 1 item', () => {
				const item = 55;
				instance.push(item);
				expect(instance.front()).toBe(item);
				instance.reverse();
				expect(instance.front()).toBe(item);
			});

			it('should not change queue size', () => {
				expect(instance.size()).toBe(0);
				const item = 55;
				instance.push(item);
				expect(instance.size()).toBe(1);
				instance.reverse();
				expect(instance.size()).toBe(1);
			});

			it('should reverse queue content ordering', () => {
				expect(instance.size()).toBe(0);
				const items = [8, 26, 79, 114, 35, 256, 7];

				items.forEach((item: number) => {
					instance.push(item);
				});

				instance.reverse();

				items.reverse();
				for (let i = 0; i < items.length; i++) {
					const result = instance.pop();
					expect(result).toBe(items[i]);
				}
			});
		});

		describe('size', () => {
			it('should return 0 when queue is empty', () => {
				expect(instance.size()).toBe(0);
				expect(instance.size()).toBe(0);
			});

			it('should return the number of items in queue', () => {
				const items = [1, 2, 3, 4, 5, 6, 7];

				items.forEach((expectedV: number) => {
					instance.push(expectedV);
					expect(instance.size()).toBe(expectedV);
				});
			});
		});

		describe('stringify', () => {
			isValidStateRuns((obj) => {
				obj.stringify();
			});

			it('should return null if isValidState returns false', () => {
				const spy = jest.spyOn(instance, 'isValidState').mockReturnValueOnce(false);
				expect(instance.stringify()).toBeNull();
			});

			it('should return the state as a string if it is validated', () => {
				const custom = new ADTQueue<number>();
				const expected: ADTQueueState<number> = {
					type: 'qState',
					elements: [],
					deepClone: false,
					objectPool: false
				};

				expect(JSON.parse(custom.stringify()!)).toStrictEqual(expected);

				custom.push(1);
				expected.elements = [1];
				expect(JSON.parse(custom.stringify()!)).toStrictEqual(expected);

				custom.push(2);
				expected.elements = [1, 2];
				expect(JSON.parse(custom.stringify()!)).toStrictEqual(expected);

				custom.pop();
				expected.elements = [2];
				expect(JSON.parse(custom.stringify()!)).toStrictEqual(expected);
			});
		});
	});

	describe('Execute Functions', () => {
		describe('execute', () => {
			let callable: any;

			beforeAll(() => {
				callable = jest.fn().mockImplementation(
					(element: any, ndx: number) =>
						new Promise((resolve, reject) => {
							resolve();
						})
				);
			});

			beforeEach(() => {
				callable.mockReset();
			});
		});

		describe('executeOnAll', () => {
			let callable: any;

			beforeAll(() => {
				callable = jest.fn().mockImplementation(
					(element: any, ndx: number) =>
						new Promise((resolve, reject) => {
							resolve();
						})
				);
			});

			beforeEach(() => {
				callable.mockReset();
			});

			it('should pass null element argument to execute method', () => {
				const elements = [41091];
				elements.forEach((elem) => {
					instance.push(elem);
				});

				const spy = jest.spyOn(instance, 'execute');
				instance.executeOnAll(callable);
				expect(spy).toHaveBeenCalledWith(expect.anything(), null);
			});

			it('should pass callable argument to execute method', () => {
				const elements = [661987];
				elements.forEach((elem) => {
					instance.push(elem);
				});

				const spy = jest.spyOn(instance, 'execute');
				instance.executeOnAll(callable);
				expect(spy).toHaveBeenCalledWith(callable, null);
			});

			it('should execute callable once per element', async () => {
				expect(callable).not.toHaveBeenCalled();
				const elements = [440194, 11129, 321330];
				const custom = new ADTQueue({elements: elements});

				expect.assertions(2);

				const spy = jest.spyOn(custom, 'execute');
				await custom.executeOnAll(callable);
				expect(callable).toHaveBeenCalledTimes(3);
			});
		});

		describe('executeOnAllSync', () => {
			let callable: any;

			beforeAll(() => {
				callable = jest.fn().mockImplementation((element: any, ndx: number) => {});
			});

			beforeEach(() => {
				callable.mockReset();
			});

			it('should pass null element argument to execute method', () => {
				const elements = [41091];
				elements.forEach((elem) => {
					instance.push(elem);
				});

				const spy = jest.spyOn(instance, 'executeSync');
				instance.executeOnAllSync(callable);
				expect(spy).toHaveBeenCalledWith(expect.anything(), null);
			});

			it('should pass callable argument to execute method', () => {
				const elements = [661987];
				elements.forEach((elem) => {
					instance.push(elem);
				});

				const spy = jest.spyOn(instance, 'executeSync');
				instance.executeOnAllSync(callable);
				expect(spy).toHaveBeenCalledWith(callable, null);
			});

			it('should execute callable once per element in queue', () => {
				expect(callable).not.toHaveBeenCalled();

				const elements = [41091, 99109, 877110];
				elements.forEach((elem) => {
					instance.push(elem);
				});

				const spy = jest.spyOn(instance, 'executeSync');
				instance.executeOnAllSync(callable);
				expect(callable).toHaveBeenCalledTimes(elements.length);
			});
		});

		describe('executeSync', () => {
			let callable: any;

			beforeAll(() => {
				callable = jest.fn().mockImplementation((element: any, ndx: number) => {});
			});

			beforeEach(() => {
				callable.mockReset();
			});

			it('should not execute the callable when queue is empty', () => {
				const custom = new ADTQueue<number>();
				custom.executeSync(callable, null);
				expect(callable).not.toHaveBeenCalled();
			});

			it('should execute callable once when queue has one item', () => {
				const custom = new ADTQueue<number>();
				custom.push(31091);
				custom.executeSync(callable, null);
				expect(callable).toHaveBeenCalledTimes(1);
			});

			it('should execute callable once for every item in queue', () => {
				const custom = new ADTQueue<number>();
				custom.push(11201);
				custom.push(22081);
				custom.push(333100);
				custom.executeSync(callable, null);
				expect(callable).toHaveBeenCalledTimes(3);
			});
		});
	});
});
