import {ADTQueryFilter} from '../src/query/filter';
import {ADTQueryOptions} from '../src/query/options';
import {ADTQueryResult} from '../src/query/result';
import {ADTStack} from '../src/stack';
import {ADTStackOptions as Options} from '../src/stack/options';
import {ADTStackState as State} from '../src/stack/state';

describe('ADTStack', () => {
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

	const DEFAULT_STATE: State<number> = {
		type: 'Stack',
		elements: [],
		size: 0,
		top: -1,
		bottom: 0
	};
	const STATE_PROPERTIES = Object.keys(DEFAULT_STATE);
	const VALID_SERIALIZED_STATE = [
		'{',
		'"type": "Stack",',
		'"elements": [1,2],',
		'"size": 2,',
		'"top": 1,',
		'"bottom": 0',
		'}'
	].join('');

	const ITEMS = [90, 70, 50, 30, 10, 80, 60, 40, 20];

	const isValidStateRuns = function (action: (obj: any) => void): void {
		it('should run isValidState check', () => {
			const custom: ADTStack<number> = new ADTStack<number>();
			const spy = jest.spyOn(custom, 'isValidState');
			spy.mockClear();
			custom.state.type = '' as any;
			action(custom);
			expect(spy).toBeCalled();
		});
	};
	const queryFilter = function (target: number): ADTQueryFilter<number> {
		const filter: ADTQueryFilter<number> = (element): boolean => {
			return element === target;
		};

		return filter;
	};

	let instance: ADTStack<number>;

	beforeAll(() => {
		instance = new ADTStack<number>();
	});

	beforeEach(() => {
		instance.reset();
	});

	describe('Constructor', () => {
		describe('constructor', () => {
			it('should initialize empty queue', () => {
				const custom = new ADTStack<number>();
				expect(custom.size()).toBe(0);
			});

			it('should initialize with serializedState', () => {
				const custom = new ADTStack<number>({serializedState: VALID_SERIALIZED_STATE});
				expect(JSON.parse(custom.stringify()!)).toStrictEqual(JSON.parse(VALID_SERIALIZED_STATE));
			});

			it('should initialize with other options overriding serializedState if they are valid', () => {
				const expectedV: State<number> = JSON.parse(VALID_SERIALIZED_STATE);
				const result1 = new ADTStack<number>({
					serializedState: VALID_SERIALIZED_STATE,
					elements: -4 as any
				});
				expect(JSON.parse(result1.stringify()!)).toStrictEqual(expectedV);

				expectedV.elements = [3, 4];
				const result2 = new ADTStack<number>({
					serializedState: VALID_SERIALIZED_STATE,
					elements: expectedV.elements
				});
				expect(JSON.parse(result2.stringify()!)).toStrictEqual(expectedV);
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

				expect(
					instance.parseOptions({
						serializedState: VALID_SERIALIZED_STATE,
						elements: expectedV.elements
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
				const expectedErrorEnd = Error('Unexpected end of JSON input');
				expect(instance.parseOptionsStateString('[4,3,')).toContainEqual(expectedErrorEnd);

				const expectedErrorToken = Error('Unexpected token l in JSON at position 1');
				expect(instance.parseOptionsStateString('{left:f,right:')).toContainEqual(expectedErrorToken);
			});

			const toParseList = ['{}', '{"type": "Stack"}', '{"elements":4, "type": "Stack"}'];
			it.each(toParseList)('should return errors, %p wont parse into an ADTStackState', (toParse) => {
				let errors: Error[] = [];
				errors = instance.getStateErrors(JSON.parse(toParse) as any);
				errors.unshift(Error('state is not a valid ADTStackState'));
				expect(instance.parseOptionsStateString(toParse)).toStrictEqual(errors);
			});

			it('should return an ADTStackState when a parsable string is passed', () => {
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
				const opts: Required<Omit<Options<number>, 'serializedState'>> = {
					elements: []
				};

				const expectedV = {...DEFAULT_STATE, ...opts};
				const result = instance.parseOptionsOther({...DEFAULT_STATE}, opts);

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

			const testSuite = [null, undefined, '', 0];
			it.each(testSuite)('should return errors if state is %p', (myTest) => {
				const expectedV = Error('state is null or undefined');
				const errors = instance.getStateErrors(myTest as any);

				expect(Array.isArray(errors)).toBe(true);
				expect(errors).toContainEqual(expectedV);
			});
		});

		const stateTestSuiteObj = [
			{
				prop: 'Type',
				result: 'not "Stack"',
				testSuite: ([] as any).concat([null, undefined, '', 'state']),
				expectedV: Error('state type must be Stack')
			},
			{
				prop: 'Elements',
				result: 'not an array',
				testSuite: ([] as any).concat([{}, null, undefined, '', 'teststring']),
				expectedV: Error('state elements must be an array')
			},
			{
				prop: 'Size',
				result: 'not an integer >= 0',
				testSuite: ([] as any).concat(NAN_VALUES, FLOAT_VALUES, NEG_INT_VALUES),
				expectedV: Error('state size must be an integer >= 0')
			},
			{
				prop: 'Top',
				result: 'not an integer',
				testSuite: ([] as any).concat(NAN_VALUES, FLOAT_VALUES),
				expectedV: Error('state top must be an integer')
			},
			{
				prop: 'Bottom',
				result: 'not 0',
				testSuite: ([] as any[]).concat(NAN_VALUES, FLOAT_VALUES, NEG_INT_VALUES, POS_INT_VALUES),
				expectedV: Error('state bottom must be 0')
			}
		];
		const stateTestSuite = stateTestSuiteObj.map((elem) => {
			return [elem.prop, elem.result, elem.testSuite, elem.expectedV];
		});

		describe.each(stateTestSuite)('getStateErrors%s', (prop, result, myTests, expectedV) => {
			it.each(myTests)(`should return errors, ${prop} is %p, ${result}`, (myTest) => {
				const errors = instance[`getStateErrors${prop}`](myTest);

				expect(Array.isArray(errors)).toBe(true);
				expect(errors).toContainEqual(expectedV);
			});
		});

		describe('isInteger', () => {
			const testSuiteObj: Array<{resultText: string; testSuite: any[]; expectedV: boolean}> = [
				{
					resultText: 'true, n is an integer',
					testSuite: ([] as any).concat(INT_VALUES),
					expectedV: true
				},
				{
					resultText: 'false, n is not an integer',
					testSuite: ([] as any).concat(FLOAT_VALUES, NAN_VALUES),
					expectedV: false
				}
			];
			const testSuite: Array<any[]> = testSuiteObj.map((elem) => {
				return [elem.resultText, elem.testSuite, elem.expectedV];
			});

			describe.each(testSuite)('should return %s', (resultText, myTests, expectedV) => {
				it.each(myTests)(`should return ${resultText}, it is %p`, (myTest) => {
					expect(instance.isInteger(myTest)).toBe(expectedV);
				});
			});
		});

		describe('isValidState', () => {
			it('should return true if state is a valid ADTCircularQueueState', () => {
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
				const expectedSize = ITEMS.length;
				expect(instance.size()).toBe(expectedSize);

				const queryResults = instance.query(queryFilter(instance.top()!));
				expect(queryResults.length).toBe(1);
				queryResult = queryResults[0];

				const spy = jest.spyOn(queryResult, 'index').mockImplementation(() => {
					return null;
				});

				expect(instance.queryDelete(queryResult)).toBeNull();
				expect(instance.size()).toBe(expectedSize);

				spy.mockRestore();
			});

			it('should return element if it is in queue', () => {
				const expectedSize = ITEMS.length;
				expect(instance.size()).toBe(expectedSize);

				const queryResults = instance.query(queryFilter(instance.top()!));
				expect(queryResults.length).toBe(1);
				queryResult = queryResults[0];

				expect(instance.queryDelete(queryResult)).toBe(queryResult.element);
			});

			it('should delete the element from queue', () => {
				const expectedSize = ITEMS.length;
				expect(instance.size()).toBe(expectedSize);

				const queryResults = instance.query(queryFilter(instance.top()!));
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
				const expectedSize = ITEMS.length;
				expect(instance.size()).toBe(expectedSize);

				const queryResults = instance.query(queryFilter(instance.top()!));
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
				const opts1 = instance.queryOptions();
				const opts2 = instance.queryOptions({});
				const opts3 = instance.queryOptions({limit: 99});
				const opts4 = instance.queryOptions({limit: '99' as any});

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
				const expectedV = {...DEFAULT_OPTS};
				const opts: ADTQueryOptions = {};
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

			const testSuite = ([0] as any).concat(NAN_VALUES, NEG_NUM_VALUES);
			it.each(testSuite)('should ignore limit = %p, not a number >= 1', (myTest) => {
				const opts = {limit: myTest as any};
				expect(instance.queryOptions(opts)).toStrictEqual(DEFAULT_OPTS);
			});
		});
	});

	describe('Implementation', () => {
		describe('bottom', () => {
			it('should return null when stack is empty', () => {
				expect(instance.size()).toBe(0);
				expect(instance.bottom()).toBeNull();
			});

			it('should return the element on bottom of stack', () => {
				expect(instance.size()).toBe(0);
				const expectedValue = 90110;
				instance.push(expectedValue);
				instance.push(111091);
				instance.push(444209);
				expect(instance.bottom()).toBe(expectedValue);
			});
		});

		describe('clearElements', () => {
			it('should not throw when stack is empty', () => {
				expect(instance.size()).toBe(0);
				expect(() => {
					instance.clearElements();
				}).not.toThrow();
			});

			it('should remove all items from stack', () => {
				expect(instance.size()).toBe(0);
				const items = [1, 2, 3, 4, 5, 6, 7];

				items.forEach((item: number) => {
					instance.push(item);
				});

				expect(instance.state.top).toBe(items.length - 1);
				instance.clearElements();
				expect(instance.size()).toBe(0);
			});

			it('should reset top to -1', () => {
				instance.push(1211);
				instance.push(1233);
				instance.push(1255);
				instance.clearElements();
				expect(instance.state.top).toBe(-1);
			});

			it('should reset size to 0', () => {
				instance.push(111);
				instance.push(333);
				instance.push(444);
				instance.clearElements();
				expect(instance.size()).toBe(0);
			});

			it('should not change any other state variables', () => {
				const custom = new ADTStack<number>();

				custom.state.type = 'test' as any;

				custom.clearElements();

				expect(custom.state.type).toBe('test');
			});
		});

		describe('forEach', () => {
			const testSuite: any = [
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

				const expectedV = myTest.join('');
				const expectedCount = instance.size();
				let count = 0;
				instance.forEach((elem, index) => {
					count++;
					instance.state.elements[index] = expectedV as any;
				});

				expect(count).toBe(expectedCount);
				expect(instance.top()).toBe(expectedV);
				expect(instance.bottom()).toBe(expectedV);
			});

			it.each(['boundThis', 'unboundThis'])(
				'should pass element, index, array to callback function (%p)',
				(useThis) => {
					instance.push(1).push(2).push(3);
					let boundThis;
					if (useThis === 'boundThis') {
						boundThis = instance;
					} else {
						boundThis = {};
					}

					instance.forEach(function (element, index, arr) {
						expect(this).toBe(boundThis);
						expect(arr).toBeInstanceOf(Array);
						expect(index).toBeGreaterThanOrEqual(0);
						expect(element).toBe(arr[index]);
					}, boundThis);
				}
			);
		});

		describe('pop', () => {
			it('should return null when stack is empty', () => {
				expect(instance.size()).toBe(0);
				expect(instance.pop()).toBeNull();
			});

			it('should decrease the stack size for element popped', () => {
				const elements = [111092, 44108914, 11092, 441091, 511091];
				for (let i = 0; i < elements.length; i++) {
					instance.push(elements[i]);
				}

				let size = elements.length;
				for (let i = 0; i < elements.length; i++) {
					size--;
					instance.pop();
					expect(instance.size()).toBe(size);
				}
			});
		});

		describe('push', () => {
			it('should return the stack instance', () => {
				expect(instance.push(11141) instanceof ADTStack).toBe(true);
			});

			it('should increase the size for each element added', () => {
				const elements = [111092, 44108914, 11092, 441091, 511091];
				for (let i = 0; i < elements.length; i++) {
					instance.push(elements[i]);
					expect(instance.size()).toBe(i + 1);
				}
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
				const expectedSize = ITEMS.length;
				expect(instance.size()).toBe(expectedSize);
				expect(instance.query([])).toEqual([]);
			});

			it('should return all elements matching filter', () => {
				const expectedSize = ITEMS.length;
				expect(instance.size()).toBe(expectedSize);
				const query = 15;
				expect(instance.query(queryFilter(query)).length).toBe(0);

				const expectedV = 3;
				for (let i = 0; i < expectedV; i++) {
					instance.push(query);
				}

				expect(instance.query(queryFilter(query)).length).toBe(expectedV);
			});

			it('should return all elements matching filter up to limit', () => {
				const expectedSize = ITEMS.length;
				expect(instance.size()).toBe(expectedSize);
				const query = 45;
				expect(instance.query(queryFilter(query)).length).toBe(0);

				const expectedV = 2;
				for (let i = 0; i < expectedV * 2; i++) {
					instance.push(query);
				}

				spyOpts.mockReturnValue({limit: expectedV});
				expect(instance.query(queryFilter(query)).length).toBe(expectedV);
			});

			it('should return elements that match all filters', () => {
				const customFilter = function (target: number, lessthan: boolean): ADTQueryFilter<number> {
					const filter: ADTQueryFilter<number> = (element): boolean => {
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

				const result = instance.query([customFilter(60, true), customFilter(30, false)]);
				expect(result.length).toBe(2);
				const resultValues: number[] = [];
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

			it('should return the stack', () => {
				expect(instance.reset()).toBe(instance);
			});

			it('should call clearElements', () => {
				const spy = jest.spyOn(instance, 'clearElements');
				expect(spy).not.toBeCalled();

				instance.reset();
				expect(spy).toBeCalled();
			});

			it('should remove all data from queue', () => {
				const custom = new ADTStack<number>();

				custom.state.type = 'test' as any;
				custom.state.bottom = 'test' as any;

				custom.reset();

				expect(custom.state.type).toBe('Stack');
				expect(custom.state.bottom).toBe(0);
			});
		});

		describe('reverse', () => {
			it('should reverse element order', () => {
				const elements = [11091, 448101, 449551, 55801];
				elements.forEach((element: number) => {
					instance.push(element);
				});

				instance.reverse();

				for (let i = 0; i < elements.length; i++) {
					const result = instance.pop();
					expect(result).toBe(elements[i]);
				}
			});

			it('should return stack instance when stack is empty', () => {
				expect(instance.size()).toBe(0);
				expect(instance.reverse() instanceof ADTStack).toBe(true);
			});

			it('should return stack instance', () => {
				instance.push(44113);
				instance.push(44712);
				instance.push(55710);
				expect(instance.reverse() instanceof ADTStack).toBe(true);
			});
		});

		describe('size', () => {
			isValidStateRuns((obj) => {
				obj.size();
			});

			it('should return null if isValidState returns false', () => {
				const spy = jest.spyOn(instance, 'isValidState').mockReturnValueOnce(false);
				expect(instance.size()).toBe(0);
			});

			it('should return 0 when priority queue is empty', () => {
				expect(instance.size()).toBe(0);
			});

			it('should return 1 when pq has 1 item', () => {
				instance.push(Math.floor(Math.random() * 99999));
				expect(instance.size()).toBe(1);
			});

			it('should return the number of items in priority queue', () => {
				const limit = 5;

				for (let i = 0; i < limit; i++) {
					instance.push(Math.floor(Math.random() * 99999));
					expect(instance.size()).toBe(i + 1);
				}

				expect(instance.size()).toBe(limit);
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
				const custom = new ADTStack<number>();
				const expected: State<number> = {
					type: 'Stack',
					elements: [],
					size: 0,
					top: -1,
					bottom: 0
				};

				expect(JSON.parse(custom.stringify()!)).toStrictEqual(expected);

				custom.push(1);
				expected.elements = [1];
				expected.size = 1;
				expected.top = 0;
				expect(JSON.parse(custom.stringify()!)).toStrictEqual(expected);

				custom.push(2);
				expected.elements = [1, 2];
				expected.size = 2;
				expected.top = 1;
				expect(JSON.parse(custom.stringify()!)).toStrictEqual(expected);

				custom.pop();
				expected.elements = [1, 2];
				expected.size = 1;
				expected.top = 0;
				expect(JSON.parse(custom.stringify()!)).toStrictEqual(expected);
			});
		});

		describe('top', () => {
			it('should return null when stack is empty', () => {
				expect(instance.size()).toBe(0);
				expect(instance.top()).toBeNull();
			});

			it('should return the element on top of stack', () => {
				expect(instance.size()).toBe(0);
				const expectedValue = 661784;
				instance.push(133801);
				instance.push(201901);
				instance.push(expectedValue);
				expect(instance.top()).toBe(expectedValue);
			});

			it('should return element on top of stack after an element is removed', () => {
				expect(instance.size()).toBe(0);
				const expectedValue = 955510;
				instance.push(441091);
				instance.push(expectedValue);
				instance.push(779188);
				instance.pop();
				expect(instance.top()).toBe(expectedValue);
			});

			it('should return element on top of stack after multiple elements are removed', () => {
				expect(instance.size()).toBe(0);
				const expectedValue = 1200001;
				instance.push(33311);
				instance.push(442133);
				instance.push(918471);
				instance.push(expectedValue);
				instance.push(11001481);
				instance.push(2220911);
				instance.push(2230182);
				instance.pop();
				instance.pop();
				instance.pop();
				expect(instance.top()).toBe(expectedValue);
			});
		});
	});
});
