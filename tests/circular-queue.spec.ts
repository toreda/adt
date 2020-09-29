import {ADTCircularQueue} from '../src/circular-queue/circular-queue';
import {ADTCircularQueueState} from '../src/circular-queue/circular-queue-state';
import {ADTQueryFilter} from '../src/query/query-filter';
import {ADTQueryOptions} from '../src/query/query-options';
import {ADTQueryResult} from '../src/query/query-result';

describe('ADTCircularQueue', () => {
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

	const STATE_PROPERTIES = ['type', 'elements', 'overwrite', 'maxSize', 'size', 'front', 'rear'];
	const VALID_SERIALIZED_STATE = [
		'{',
		'"type": "cqState",',
		'"elements": [1,2],',
		'"overwrite": false,',
		'"maxSize": 9,',
		'"size": 2,',
		'"front": 3,',
		'"rear": 5',
		'}'
	].join('');
	const DEFAULT_STATE: ADTCircularQueueState<number> = {
		type: 'cqState',
		elements: [],
		overwrite: false,
		size: 0,
		maxSize: 100,
		front: 0,
		rear: 0
	};

	const ITEMS = [90, 70, 50, 30, 10, 80, 60, 40, 20];
	const MAX_SIZE = 4;

	const isValidStateRuns = function (action: Function) {
		it('should run isValidState check', () => {
			const custom: ADTCircularQueue<number> = new ADTCircularQueue<number>();
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

	let instance: ADTCircularQueue<number>;

	beforeAll(() => {
		instance = new ADTCircularQueue<number>({maxSize: MAX_SIZE});
	});

	beforeEach(() => {
		instance.reset();
	});

	describe('Constructor', () => {
		describe('constructor', () => {
			it('should initialize with default state when no options are paseed', () => {
				const custom = new ADTCircularQueue<number>();
				expect(JSON.parse(custom.stringify()!)).toStrictEqual(DEFAULT_STATE);
			});

			it('should initialize with serializedState', () => {
				const custom = new ADTCircularQueue<number>({serializedState: VALID_SERIALIZED_STATE});
				expect(JSON.parse(custom.stringify()!)).toStrictEqual(JSON.parse(VALID_SERIALIZED_STATE));
			});

			it('should initialize with other options overriding serializedState if they are valid', () => {
				const expected: ADTCircularQueueState<number> = JSON.parse(VALID_SERIALIZED_STATE);
				expected.maxSize = 40;

				const custom = new ADTCircularQueue<number>({
					serializedState: VALID_SERIALIZED_STATE,
					maxSize: expected.maxSize,
					size: -1
				});

				expect(JSON.parse(custom.stringify()!)).toStrictEqual(expected);
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

				expectedV.maxSize = 999;
				expect(
					instance.parseOptions({
						serializedState: VALID_SERIALIZED_STATE,
						maxSize: expectedV.maxSize
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

			it('should return serializedState as ADTCircularQueueState if it is valid', () => {
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

			const toParseList = ['{}', '{"type": "cqState"}', '{"elements":4, "type": "cqState"}'];
			it.each(toParseList)('should return errors, %p wont parse into an ADTCircularQueueState', (toParse) => {
				let errors: Array<string> = [];
				errors = instance.getStateErrors(JSON.parse(toParse) as any);
				errors.unshift('state is not a valid ADTCircularQueueState');
				expect(instance.parseOptionsStateString(toParse)).toStrictEqual(errors);
			});

			it('should return an ADTCircularQueueState when a parsable string is passed', () => {
				const expectedV = JSON.parse(VALID_SERIALIZED_STATE);
				expect(instance.parseOptionsStateString(VALID_SERIALIZED_STATE)).toStrictEqual(expectedV);
			});
		});

		describe('parseOptionsOther', () => {
			it('should return the default state if options is falsey', () => {
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
				const expectedV: ADTCircularQueueState<number> = {...DEFAULT_STATE};
				expectedV.maxSize = 99;

				const result = instance.parseOptionsOther(
					{...DEFAULT_STATE},
					{
						maxSize: expectedV.maxSize,
						size: -1
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
					result: 'not "cqState"',
					testSuite: ([] as any).concat([null, undefined, '', 'state']),
					expectedV: 'state type must be cqState'
				},
				{
					prop: 'elements',
					result: 'not an array',
					testSuite: ([] as any).concat([{}, null, undefined, '', 'teststring']),
					expectedV: 'state elements must be an array'
				},
				{
					prop: 'overwrite',
					result: 'not a boolean',
					testSuite: ([] as any).concat([{}, '', 'true', 'false', 0, 1, null, undefined]),
					expectedV: 'state overwrite must be a boolean'
				},
				{
					prop: 'maxSize',
					result: 'not an integer >= 0',
					testSuite: ([0] as any).concat(NAN_VALUES, FLOAT_VALUES, NEG_INT_VALUES),
					expectedV: 'state maxSize must be an integer >= 1'
				},
				{
					prop: 'size',
					result: 'not an integer >= 1',
					testSuite: ([] as any).concat(NAN_VALUES, FLOAT_VALUES, NEG_INT_VALUES),
					expectedV: 'state size must be an integer >= 0'
				},
				{
					prop: 'front',
					result: 'not an integer',
					testSuite: ([] as any).concat(NAN_VALUES, FLOAT_VALUES),
					expectedV: 'state front must be an integer'
				},
				{
					prop: 'rear',
					result: 'not an integer',
					testSuite: ([] as any).concat(NAN_VALUES, FLOAT_VALUES),
					expectedV: 'state rear must be an integer'
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

		describe('isInteger', () => {
			let testSuiteObj: Array<{resultText: string; testSuite: any[]; expectedV: boolean}> = [
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
			let testSuite: Array<any[]> = testSuiteObj.map((elem) => {
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
				let expectedSize = Math.min(instance.state.maxSize, ITEMS.length);
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

			it('should return element if it is in cq', () => {
				let expectedSize = Math.min(instance.state.maxSize, ITEMS.length);
				expect(instance.size()).toBe(expectedSize);

				let queryResults = instance.query(queryFilter(instance.front()!));
				expect(queryResults.length).toBe(1);
				queryResult = queryResults[0];

				expect(instance.queryDelete(queryResult)).toBe(queryResult.element);
			});

			it('should delete the element from cq', () => {
				let expectedSize = Math.min(instance.state.maxSize, ITEMS.length);
				expect(instance.size()).toBe(expectedSize);

				let queryResults = instance.query(queryFilter(instance.front()!));
				expect(queryResults.length).toBe(1);
				queryResult = queryResults[0];

				instance.queryDelete(queryResult);
				expect(instance.size()).toBe(expectedSize - 1);
			});

			it('should move the rear index back one', () => {
				let expectedSize = Math.min(instance.state.maxSize, ITEMS.length);
				expect(instance.size()).toBe(expectedSize);

				let queryResults = instance.query(queryFilter(instance.front()!));
				queryResult = queryResults[0];

				let rear = instance.state.rear;
				let expectedV = instance.wrapIndex(rear! - 1);

				instance.queryDelete(queryResult);
				expect(instance.state.rear).toBe(expectedV);
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

			it('should return null if element is not in cq', () => {
				let expectedSize = Math.min(instance.state.maxSize, ITEMS.length);
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

		describe('wrapIndex', () => {
			let testSuite = ([MAX_SIZE - 1, MAX_SIZE, Math.round(MAX_SIZE * 3.5)] as any).concat(INT_VALUES);
			it.each(testSuite)(`should return num 0 to ${MAX_SIZE - 1} (maxSize-1), %p is an integer`, (myTest) => {
				const res = instance.wrapIndex(myTest);
				expect(res).toBeGreaterThanOrEqual(0);
				expect(res).toBeLessThan(instance.state.maxSize);
			});

			testSuite = ([] as any[]).concat(FLOAT_VALUES, NAN_VALUES);
			it.each(testSuite)('should return -1, %p is not an integer', (myTest) => {
				expect(instance.wrapIndex(myTest)).toBe(-1);
			});
		});
	});

	describe('Implementation', () => {
		describe('clearElements', () => {
			it('should not throw if circular queue is empty', () => {
				expect(instance.size()).toBe(0);
				expect(() => {
					instance.clearElements();
				}).not.toThrow();
			});

			it('should remove all elements from cq and reset size, front, and rear to 0', () => {
				instance.push(1);
				instance.push(2);
				instance.pop();

				expect(instance.state.elements).not.toStrictEqual([]);
				expect(instance.size()).not.toBe(0);
				expect(instance.state.front).not.toBe(0);
				expect(instance.state.rear).not.toBe(0);

				instance.clearElements();

				expect(instance.state.elements).toStrictEqual([]);
				expect(instance.size()).toBe(0);
				expect(instance.state.front).toBe(0);
				expect(instance.state.rear).toBe(0);
			});

			it('should not change any other state variables', () => {
				const custom = new ADTCircularQueue<number>();

				custom.state.type = 'test' as any;
				custom.state.overwrite = 'test' as any;
				custom.state.maxSize = 'test' as any;

				custom.clearElements();

				expect(custom.state.type).toBe('test');
				expect(custom.state.overwrite).toBe('test');
				expect(custom.state.maxSize).toBe('test');
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
				expect(instance.rear()).toBe(expectedV);
			});

			it.each(['boundThis', 'unboundThis'])(
				'should pass element, index, array to callback function (%p)',
				(useThis) => {
					instance.push(1);
					instance.push(2);
					instance.push(3);
					instance.pop();

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

		describe('front', () => {
			isValidStateRuns((obj) => {
				obj.front();
			});

			it('should return null if isValidState returns false', () => {
				const spy = jest.spyOn(instance, 'isValidState').mockReturnValueOnce(false);
				expect(instance.front()).toBeNull();
			});

			it('should return null if size is 0', () => {
				instance.state.size = 0;
				expect(instance.front()).toBeNull();
			});

			it('should return the first element in the CQ', () => {
				instance.push(1);
				instance.push(2);
				expect(instance.front()).toBe(1);
				instance.pop();
				expect(instance.front()).toBe(2);
				instance.push(3);
				instance.push(4);
				instance.push(5);
				expect(instance.front()).toBe(2);
			});

			it('should return a non null value when state.front is < 0 or >= maxSize', () => {
				instance.push(1);
				instance.state.front = -1;
				expect(instance.front()).not.toBeNull();
				instance.state.front = MAX_SIZE;
				expect(instance.front()).not.toBeNull();
				instance.state.front = Math.round(MAX_SIZE * 2.5);
				expect(instance.front()).not.toBeNull();
			});
		});

		describe('getIndex', () => {
			isValidStateRuns((obj) => {
				obj.getIndex();
			});

			it('should return null if isValidState returns false', () => {
				const spy = jest.spyOn(instance, 'isValidState').mockReturnValueOnce(false);
				expect(instance.getIndex(0)).toBeNull();
			});

			const testSuite = ([] as any).concat(NAN_VALUES, FLOAT_VALUES);
			it.each(testSuite)('should return null, index (%p) is not an integer', (myTest) => {
				expect(instance.getIndex(myTest!)).toBeNull();
			});

			it('should return null if size is 0', () => {
				instance.state.size = 0;
				expect(instance.getIndex(0)).toBeNull();
			});

			it('should return the first element in the CQ if index is 0', () => {
				instance.push(1);
				instance.push(2);
				expect(instance.getIndex(0)).toBe(1);
				instance.pop();
				expect(instance.getIndex(0)).toBe(2);
				instance.push(3);
				instance.push(4);
				instance.push(5);
				expect(instance.getIndex(0)).toBe(2);
			});

			it('should return the element n indices after front if n is a positive integer', () => {
				instance.state.elements = [-1, -1, -1, -1];
				instance.push(1);
				instance.push(2);
				expect(instance.getIndex(1)).toBe(2);
				expect(instance.getIndex(2)).toBe(-1);
				instance.pop();
				expect(instance.getIndex(1)).toBe(-1);
				expect(instance.getIndex(2)).toBe(-1);
				instance.push(3);
				instance.push(4);
				instance.push(5);
				expect(instance.getIndex(1)).toBe(3);
				expect(instance.getIndex(2)).toBe(4);
				expect(instance.getIndex(3)).toBe(5);
				expect(instance.getIndex(4)).toBe(2);
			});

			it('should return the element n indices after front if n is a negative integer', () => {
				instance.state.elements = [-1, -1, -1, -1];
				instance.push(1);
				instance.push(2);
				// [1,2,-1,-1]
				expect(instance.getIndex(-1)).toBe(1);
				expect(instance.getIndex(-2)).toBe(-1);
				instance.pop();
				// [1,2,-1,-1]
				expect(instance.getIndex(-1)).toBe(1);
				expect(instance.getIndex(-2)).toBe(-1);
				instance.push(3);
				instance.push(4);
				instance.push(5);
				// [5,2,3,4]
				expect(instance.getIndex(-1)).toBe(4);
				expect(instance.getIndex(-2)).toBe(3);
				expect(instance.getIndex(-3)).toBe(2);
				expect(instance.getIndex(-4)).toBe(5);
			});
		});

		describe('isEmpty', () => {
			isValidStateRuns((obj) => {
				obj.isEmpty();
			});

			it('should return null if isValidState returns false', () => {
				const spy = jest.spyOn(instance, 'isValidState').mockReturnValueOnce(false);
				expect(instance.isEmpty()).toBe(false);
			});

			it('should return true if size === 0', () => {
				instance.state.size = 0;
				expect(instance.isEmpty()).toBe(true);
			});

			it('should return false if size is > 0', () => {
				const myTests = [1, instance.state.maxSize - 1, instance.state.maxSize, instance.state.maxSize * 2];
				myTests.forEach((myTest) => {
					instance.state.size = myTest;
					expect(instance.isEmpty()).toBe(false);
				});
			});
		});

		describe('isFull', () => {
			isValidStateRuns((obj) => {
				obj.isFull();
			});

			it('should return null if isValidState returns false', () => {
				const spy = jest.spyOn(instance, 'isValidState').mockReturnValueOnce(false);
				expect(instance.isFull()).toBe(false);
			});

			it('should return true if size >= maxSize', () => {
				const myTests = [MAX_SIZE, MAX_SIZE * 2];
				myTests.forEach((myTest) => {
					instance.state.size = myTest;
					expect(instance.isFull()).toBe(true);
				});
			});

			it('should return false if 0 <= size < maxSize ', () => {
				const myTests = [0, 1, instance.state.maxSize - 1];
				myTests.forEach((myTest) => {
					instance.state.size = myTest;
					expect(instance.isFull()).toBe(false);
				});
			});
		});

		describe('pop', () => {
			isValidStateRuns((obj) => {
				obj.pop();
			});

			it('should return null if isValidState returns false', () => {
				const spy = jest.spyOn(instance, 'isValidState').mockReturnValueOnce(false);
				expect(instance.pop()).toBeNull();
			});

			it('should return null when cq is empty', () => {
				expect(instance.size()).toBe(0);
				expect(instance.pop()).toBeNull();
				expect(instance.pop()).toBeNull();
				instance.push(1);
				expect(instance.pop()).not.toBeNull();
				expect(instance.pop()).toBeNull();
				expect(instance.pop()).toBeNull();
			});

			it('should return front element and shrink cq by 1', () => {
				instance.push(10);
				instance.push(20);
				instance.push(30);

				expect(instance.size()).toBe(3);
				expect(instance.state.front).toBe(0);
				expect(instance.pop()).toBe(instance.state.elements[0]);
				expect(instance.size()).toBe(2);
				expect(instance.state.front).toBe(1);
			});

			it('should return elements until cq is empty and then return null', () => {
				const custom = new ADTCircularQueue<number>({maxSize: 10});
				for (let i = 0; i < custom.state.maxSize; i++) {
					custom.push(i + 1);
				}

				for (let i = 0; i < custom.state.maxSize; i++) {
					expect(custom.pop()).toBe(i + 1);
					expect(custom.size()).toBe(10 - i - 1);
				}

				expect(custom.size()).toBe(0);
				expect(custom.pop()).toBeNull();
			});
		});

		describe('push', () => {
			isValidStateRuns((obj) => {
				obj.push();
			});

			it('should return false if isValidState returns false', () => {
				const spy = jest.spyOn(instance, 'isValidState').mockReturnValueOnce(false);
				expect(instance.push(0)).toBe(false);
			});

			it('should return false and leave cq alone if cq is full and overwrite is false', () => {
				instance.state.elements = [10, 20, 30, 40];
				instance.state.front = 0;
				instance.state.rear = 0;
				instance.state.size = 4;

				const state = instance.stringify();

				expect(instance.isFull()).toBe(true);
				expect(instance.push(50)).toBe(false);
				expect(instance.stringify()).toBe(state);
			});

			it('should return true, overwrite front, and increment if cq is full and overwrite is true', () => {
				instance.state.overwrite = true;
				instance.state.elements = [10, 20, 30, 40];
				instance.state.front = 0;
				instance.state.rear = 0;
				instance.state.size = 4;

				const state = instance.stringify();

				expect(instance.isFull()).toBe(true);
				expect(instance.push(50)).toBe(true);
				expect(instance.state.elements).toStrictEqual([50, 20, 30, 40]);
				instance.state.overwrite = false;
			});

			it('should return true and increment rear and size when push is called once', () => {
				expect(instance.size()).toBe(0);
				expect(instance.state.front).toBe(0);
				expect(instance.state.rear).toBe(0);

				expect(instance.push(10)).toBe(true);
				expect(instance.state.front).toBe(0);
				expect(instance.size()).toBe(1);
				expect(instance.state.rear).toBe(1);
				expect(instance.state.elements).toStrictEqual([10]);

				instance.push(20);
				instance.push(30);
				instance.push(40);
				instance.pop();
				expect(instance.state.front).toBe(1);
				expect(instance.size()).toBe(3);
				expect(instance.state.rear).toBe(0);
				expect(instance.state.elements).toStrictEqual([10, 20, 30, 40]);

				expect(instance.push(50)).toBe(true);
				expect(instance.state.front).toBe(1);
				expect(instance.size()).toBe(4);
				expect(instance.state.rear).toBe(1);
				expect(instance.state.elements).toStrictEqual([50, 20, 30, 40]);
			});

			it('should push 15 items into cq while maintaining a size of 1 if overwrite is false', () => {
				expect(instance.size()).toBe(0);
				expect(instance.state.elements).toStrictEqual([]);

				const limit = 15;
				for (let i = 0; i < limit; i++) {
					instance.pop();
					expect(instance.state.front).toBe(i % instance.state.maxSize);
					expect(instance.push(i * 10)).toBe(true);
					expect(instance.size()).toBe(1);
				}

				expect(instance.state.elements).toStrictEqual([120, 130, 140, 110]);
			});

			it('should push 15 items into cq while maintaining a size of 1 if overwrite is true', () => {
				instance.state.overwrite = true;
				expect(instance.size()).toBe(0);
				expect(instance.state.elements).toStrictEqual([]);

				const limit = 15;
				for (let i = 0; i < limit; i++) {
					instance.pop();
					expect(instance.state.front).toBe(i % instance.state.maxSize);
					expect(instance.push(i * 10)).toBe(true);
					expect(instance.size()).toBe(1);
				}

				expect(instance.state.elements).toStrictEqual([120, 130, 140, 110]);
				instance.state.overwrite = false;
			});

			it('should push items into cq and overwrite front when full', () => {
				instance.state.overwrite = true;
				expect(instance.size()).toBe(0);
				expect(instance.state.elements).toStrictEqual([]);

				const limit = 15;
				const expected = [0, 0, 0, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3];
				for (let i = 0; i < limit; i++) {
					expect(instance.push(i * 10)).toBe(true);
					expect(instance.state.front).toBe(expected[i]);
				}

				expect(instance.state.elements).toStrictEqual([120, 130, 140, 110]);
				instance.state.overwrite = false;
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
				let expectedSize = Math.min(instance.state.maxSize, ITEMS.length);
				expect(instance.size()).toBe(expectedSize);
				expect(instance.query([])).toEqual([]);
			});

			it('should return all elements matching filter', () => {
				let expectedSize = Math.min(instance.state.maxSize, ITEMS.length);
				expect(instance.size()).toBe(expectedSize);
				let query = 15;
				instance.state.overwrite = true;
				expect(instance.query(queryFilter(query)).length).toBe(0);

				let expectedV = 3;
				for (let i = 0; i < expectedV; i++) {
					instance.push(query);
				}

				expect(instance.query(queryFilter(query)).length).toBe(expectedV);
			});

			it('should return all elements matching filter up to limit', () => {
				let expectedSize = Math.min(instance.state.maxSize, ITEMS.length);
				expect(instance.size()).toBe(expectedSize);
				let query = 45;
				instance.state.overwrite = true;
				expect(instance.query(queryFilter(query)).length).toBe(0);

				let expectedV = 2;
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
				instance.state.maxSize = 10;
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

		describe('rear', () => {
			isValidStateRuns((obj) => {
				obj.rear();
			});

			it('should return null if isValidState returns false', () => {
				const spy = jest.spyOn(instance, 'isValidState').mockReturnValueOnce(false);
				expect(instance.rear()).toBeNull();
			});

			it('should return null if size is 0', () => {
				instance.state.size = 0;
				expect(instance.rear()).toBeNull();
			});

			it('should return the last element in the CQ', () => {
				instance.push(1);
				instance.push(2);
				expect(instance.rear()).toBe(2);
				instance.pop();
				expect(instance.rear()).toBe(2);
				instance.push(3);
				instance.push(4);
				instance.push(5);
				expect(instance.rear()).toBe(5);
			});

			it('should return a non null value when state.rear is < 0 or >= maxSize', () => {
				instance.push(1);
				instance.state.rear = -1;
				expect(instance.rear()).not.toBeNull();
				instance.state.rear = MAX_SIZE;
				expect(instance.rear()).not.toBeNull();
				instance.state.rear = Math.round(MAX_SIZE * 2.5);
				expect(instance.rear()).not.toBeNull();
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

			it('should remove all data from cq', () => {
				const custom = new ADTCircularQueue<number>();

				custom.state.type = 'test' as any;
				custom.state.overwrite = 'test' as any;
				custom.state.maxSize = 'test' as any;

				custom.reset();

				expect(custom.state.type).toBe('cqState');
				expect(custom.state.overwrite).toBe('test');
				expect(custom.state.maxSize).toBe('test');
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
				const custom = new ADTCircularQueue<number>({maxSize: 10});
				expect(JSON.parse(custom.stringify()!)).toStrictEqual({
					type: 'cqState',
					elements: [],
					overwrite: false,
					size: 0,
					maxSize: 10,
					front: 0,
					rear: 0
				});

				custom.push(1);
				expect(JSON.parse(custom.stringify()!)).toStrictEqual({
					type: 'cqState',
					elements: [1],
					overwrite: false,
					size: 1,
					maxSize: 10,
					front: 0,
					rear: 1
				});

				custom.push(2);
				expect(JSON.parse(custom.stringify()!)).toStrictEqual({
					type: 'cqState',
					elements: [1, 2],
					overwrite: false,
					size: 2,
					maxSize: 10,
					front: 0,
					rear: 2
				});

				custom.pop();
				expect(JSON.parse(custom.stringify()!)).toStrictEqual({
					type: 'cqState',
					elements: [1, 2],
					overwrite: false,
					size: 1,
					maxSize: 10,
					front: 1,
					rear: 2
				});
			});
		});
	});
});
