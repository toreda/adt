import ADTPriorityQueue from '../src/priority-queue/priority-queue';
import ADTPriorityQueueComparator from '../src/priority-queue/priority-queue-comparator';
import ADTPriorityQueueState from '../src/priority-queue/priority-queue-state';
import ADTQueryFilter from '../src/query/query-filter';
import ADTQueryResult from '../src/query/query-result';

describe('ADTPriorityQueue', () => {
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

	const STATE_PROPERTIES = ['type', 'elements'];
	const VALID_SERIALIZED_STATE = ['{', '"type": "pqState",', '"elements": [1,2]', '}'].join('');
	const DEFAULT_STATE: ADTPriorityQueueState<number> = {
		type: 'pqState',
		elements: []
	};

	const ITEMS = [90, 70, 50, 30, 10, 80, 60, 40, 20];
	/**
	 * instance.state.elements is
	 * [10, 20, 60, 30, 50, 80, 70, 90, 40]
	 *               10
	 *       20              60
	 *   30      50      80      70
	 * 90  40  __  __  __  __  __  __
	 *
	 * after initialization with pushes
	 */
	const comparator: ADTPriorityQueueComparator<number> = function (a, b) {
		if (typeof a !== 'number') {
			return false;
		}
		if (typeof b !== 'number') {
			return false;
		}

		return a <= b;
	};
	const queryFilter = function (target: number): ADTQueryFilter {
		const filter: ADTQueryFilter = (element): boolean => {
			return element === target;
		};

		return filter;
	};
	const printHeap = function (obj: ADTPriorityQueue<number>) {
		let longest = 0;
		let count = 1;
		obj.state.elements.forEach((v) => {
			let size = v.toString().length;
			if (longest < size) longest = size;
		});

		while (count < obj.state.elements.length) {
			count *= 2;
		}

		let output: Array<number[]> = [];
		let temp: number[] = [];

		obj.state.elements.forEach((v, i) => {
			if (Math.log2(i + 1) % 1 == 0) {
				output.push(temp);
				temp = [];
			}
			temp.push(v);
		});
		output.push(temp);

		return output
			.map((v, i) => {
				let total = Math.pow(2, i) * 2 - 1;
				let leftpad = ' '.repeat(longest * Math.pow(2, output.length - i - 1) - longest);
				let midpad = ' '.repeat(longest * Math.pow(2, output.length - i) - longest);
				return leftpad + v.map((vv) => ('0'.repeat(longest) + vv).slice(-1 * longest)).join(midpad);
			})
			.join('\n');
	};

	let instance: ADTPriorityQueue<number>;

	beforeAll(() => {
		instance = new ADTPriorityQueue<number>(comparator);
	});

	beforeEach(() => {
		instance.reset();
	});

	describe('Constructor', () => {
		describe('constructor', () => {
			it('should throw if comparator is not a function', () => {
				expect(() => {
					const custom = new ADTPriorityQueue<number>(null as any);
				}).toThrow('Must have a comparator function for priority queue to operate properly');
			});

			it('should initialize with default state when no options are passed', () => {
				const custom = new ADTPriorityQueue<number>(comparator);
				expect(JSON.parse(custom.stringify()!)).toStrictEqual(DEFAULT_STATE);
			});

			it('should initialize with serializedState', () => {
				const custom = new ADTPriorityQueue<number>(comparator, {serializedState: VALID_SERIALIZED_STATE});
				expect(JSON.parse(custom.stringify()!)).toStrictEqual(JSON.parse(VALID_SERIALIZED_STATE));
			});

			it('should initialize with state settings overriding serializedState', () => {
				const expectedV = JSON.parse(VALID_SERIALIZED_STATE);
				expectedV.elements = [3, 4];

				const custom = new ADTPriorityQueue<number>(comparator, {
					serializedState: VALID_SERIALIZED_STATE,
					elements: expectedV.elements
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
				let expectedV = JSON.parse(VALID_SERIALIZED_STATE);

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

			describe('should throw if serializedState is not valid', () => {
				STATE_PROPERTIES.forEach((v) => {
					it(v + ' is null', () => {
						const state = {...DEFAULT_STATE};
						state[v] = null!;
						const errors = instance.getStateErrors(state);

						expect(() => {
							instance.parseOptionsState({
								serializedState: JSON.stringify(state)
							});
						}).toThrow(errors.join('\n'));
					});
				});
			});

			it('should return serializedState as ADTPriorityQueueState if it is valid', () => {
				const expectedV = JSON.parse(VALID_SERIALIZED_STATE);

				expect(
					instance.parseOptionsState({
						serializedState: VALID_SERIALIZED_STATE
					})
				).toStrictEqual(expectedV);
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

			describe('should return array of errors when a parsable string does not parse into an ADTPriorityQueueState', () => {
				const toParseList = ['{}', '{"type": "pqState"}', '{"elements":4, "type": "pqState"}'];

				toParseList.forEach((toParse) => {
					it(toParse, () => {
						let errors: Array<string> = [];
						errors = instance.getStateErrors(JSON.parse(toParse) as any);
						errors.unshift('state is not a valid ADTPriorityQueueState');
						expect(instance.parseOptionsStateString(toParse)).toStrictEqual(errors);
					});
				});
			});

			it('should return an ADTPriorityQueueState when a parsable string is passed', () => {
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
				const tests = [null, undefined];
				tests.forEach((test) => {
					expect(instance.parseOptionsOther(instance.state, test!)).toStrictEqual(instance.state);
					expect(instance.parseOptionsOther({...DEFAULT_STATE}, test!)).toStrictEqual(DEFAULT_STATE);

					const expectedV = JSON.parse(VALID_SERIALIZED_STATE);
					expect(instance.parseOptionsOther(expectedV as any, test!)).toStrictEqual(expectedV);
				});
			});

			it('should return passed state with values changed to match other passed options', () => {
				const expectedV: ADTPriorityQueueState<number> = {...DEFAULT_STATE};
				expectedV.elements = [3, 4];

				const result = instance.parseOptionsOther(
					{...DEFAULT_STATE},
					{
						elements: expectedV.elements
					}
				);

				expect(result).toStrictEqual(expectedV);
			});

			it('should return passed state with values changed to match other passed options if those are valid', () => {
				const expectedV: ADTPriorityQueueState<number> = {...DEFAULT_STATE};

				const result = instance.parseOptionsOther(
					{...DEFAULT_STATE},
					{
						elements: {} as any
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
			describe('should return array of errors if state is falsy', () => {
				const tests = [null, undefined, '', 0];
				tests.forEach((test) => {
					it(typeof test + ': ' + test, () => {
						const errors = instance.getStateErrors(test as any);
						expect(Array.isArray(errors)).toBe(true);
						expect(errors).toContain('state is null or undefined');
					});
				});
			});

			describe('should return array of errors if state.type is not "pqState"', () => {
				const tests = [null, undefined, '', 'state'];
				const expectedV = 'state type must be pqState';
				tests.forEach((test) => {
					it(typeof test + ': ' + test, () => {
						const state = {...DEFAULT_STATE, type: test as any};
						const errors = instance.getStateErrors(state);

						expect(Array.isArray(errors)).toBe(true);
						expect(errors).toContain(expectedV);
					});
				});
			});

			describe('should return array of errors if state.elements is not an array', () => {
				const tests = [{}, null, undefined, '', 'teststring'];
				const expectedV = 'state elements must be an array';
				tests.forEach((test) => {
					it(typeof test + ': ' + test, () => {
						const state = {...DEFAULT_STATE, elements: test as any};
						const errors = instance.getStateErrors(state);

						expect(Array.isArray(errors)).toBe(true);
						expect(errors).toContain(expectedV);
					});
				});
			});

			it('should return an empty array if state is valid', () => {
				expect(instance.getStateErrors(DEFAULT_STATE)).toStrictEqual([]);
			});
		});

		describe('isValidState', () => {
			it('should return true if state is a valid ADTPriorityQueueState', () => {
				expect(instance.isValidState(instance.state)).toBe(true);
			});

			it('should return false if state is null or undefined', () => {
				const tests = [null, undefined];
				tests.forEach((test) => {
					expect(instance.isValidState(test!)).toBe(false);
				});
			});

			describe('should return false if a state property is not valid', () => {
				STATE_PROPERTIES.forEach((v) => {
					it(v + ' is null', () => {
						const state = {...DEFAULT_STATE};
						state[v] = null!;
						expect(instance.isValidState(state)).toBe(false);
					});
				});
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

			describe('should return null if arg does not have an index method', () => {
				const tests = [null, undefined, '', {}];
				tests.forEach((test) => {
					it(typeof test + ': ' + test, () => {
						expect(instance.queryDelete(test as any)).toBeNull();
					});
				});
			});

			it('should return null if index is null', () => {
				let expectedSize = ITEMS.length;
				expect(instance.size()).toBe(expectedSize);

				let queryResults = instance.query(queryFilter(10));
				expect(queryResults.length).toBe(1);
				queryResult = queryResults[0];

				let spy = jest.spyOn(queryResult, 'index').mockImplementation(() => {
					return null;
				});

				expect(instance.queryDelete(queryResult)).toBeNull();
				expect(instance.size()).toBe(expectedSize);
			});

			it('should return element if it is in pq', () => {
				let expectedSize = ITEMS.length;
				expect(instance.size()).toBe(expectedSize);

				let queryResults = instance.query(queryFilter(50));
				expect(queryResults.length).toBe(1);
				queryResult = queryResults[0];

				expect(instance.queryDelete(queryResult)).toBe(queryResult.element);
			});

			it('should delete the element from pq', () => {
				let expectedSize = ITEMS.length;
				expect(instance.size()).toBe(expectedSize);

				let queryResults = instance.query(queryFilter(40));
				expect(queryResults.length).toBe(1);
				queryResult = queryResults[0];

				instance.queryDelete(queryResult);
				expect(instance.size()).toBe(expectedSize - 1);
			});

			it('should restore the heap properties', () => {
				let list: number[] = [];
				for (let i = 1; i < 27; i++) {
					list.push(Math.floor(Math.random() * 999));
				}

				list.forEach((test) => {
					instance.clearElements();
					list.forEach((v) => {
						instance.push(v);
					});

					let expectedSize = list.length;
					expect(instance.size()).toBe(expectedSize);

					let queryResults = instance.query(queryFilter(test));
					queryResult = queryResults[0];

					instance.queryDelete(queryResult);
					let result = instance.isHeapSorted();
					expect(result).toBe(true);
				});
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

			it('should return null if element is not in pq', () => {
				let expectedSize = ITEMS.length;
				expect(instance.size()).toBe(expectedSize);

				let queryResults = instance.query(queryFilter(10));
				queryResult = queryResults[0];

				queryResult.delete();
				expect(queryResult.index()).toBeNull();
			});

			it('should return the index of the queryResult even if it moves', () => {
				let expectedV = 90;
				let expectedSize = ITEMS.length;
				expect(instance.size()).toBe(expectedSize);

				let queryResults = instance.query(queryFilter(expectedV));
				queryResult = queryResults[0];

				for (let i = 0; i < ITEMS.length; i++) {
					let index = queryResult.index();
					if (index !== null) {
						expect(instance.state.elements[index!]).toBe(expectedV);
					} else {
						expect(instance.query(queryFilter(expectedV)).length).toBe(0);
					}
					instance.pop();
				}

				expect(instance.size()).toBe(0);
				expect(queryResult.index()).toBeNull();
			});
		});
	});

	describe('Heap Maintenance', () => {
		describe('areNodesValidHeap', () => {
			it('should return true if either index is not a number', () => {
				expect(instance.areNodesValidHeap(null, null)).toBe(true);
				expect(instance.areNodesValidHeap(null, 0)).toBe(true);
				expect(instance.areNodesValidHeap(0, null)).toBe(true);
			});

			describe('when a node value is null', () => {
				const tests = [
					{index1: 0, index2: 1, value1: ' 1', value2: null, expectedV: false},
					{index1: 1, index2: 2, value1: null, value2: ' 1', expectedV: true},
					{index1: 1, index2: 3, value1: null, value2: null, expectedV: true},
					{index1: 4, index2: 3, value1: ' 1', value2: null, expectedV: true},
					{index1: 3, index2: 2, value1: null, value2: ' 1', expectedV: false},
					{index1: 3, index2: 1, value1: null, value2: null, expectedV: false}
				];

				tests.forEach((test) => {
					let description = '';
					description += `(index1:${test.index1}) (index2:${test.index2}) `;
					description += `(value1:${test.value1}) (value2:${test.value2})`;
					it(description, () => {
						instance.state.elements = [1, null as any, 1, null as any, 1];
						expect(instance.areNodesValidHeap(test.index1, test.index2)).toBe(test.expectedV);
					});
				});
			});

			it('should call comparator with parameters (larger index, smaller index)', () => {
				instance.state.elements = [10, 1];
				const spy = jest.spyOn(instance, 'comparator');
				spy.mockClear();
				instance.areNodesValidHeap(0, 1);
				expect(spy).toBeCalledWith(10, 1);
				spy.mockClear();
				instance.areNodesValidHeap(1, 0);
				expect(spy).toBeCalledWith(10, 1);
				spy.mockRestore();
			});
		});

		describe('fixHeap', () => {
			let spy;

			beforeAll(() => {
				spy = jest.spyOn(instance, 'swapNodes');
			});

			beforeEach(() => {
				ITEMS.forEach((item) => {
					instance.push(item);
				});

				spy.mockClear();
			});

			afterEach(() => {
				instance.clearElements();
			});

			afterAll(() => {
				spy.mockRestore();
			});

			it('should do 0 swapNodes calls if size is 0 or 1', () => {
				instance.clearElements();
				expect(instance.size()).toBe(0);

				instance.fixHeap(0);
				instance.fixHeap(null);
				instance.fixHeap(1);
				instance.fixHeap(-1);

				instance.push(1);
				expect(instance.size()).toBe(1);

				instance.fixHeap(0);
				instance.fixHeap(null);
				instance.fixHeap(1);
				instance.fixHeap(-1);

				expect(spy).not.toBeCalled();
			});

			describe('should do 0 swapNodes calls if an invalid type is passed', () => {
				const tests = ([] as any).concat(NAN_VALUES, FLOAT_VALUES, NEG_INT_VALUES);

				tests.forEach((test) => {
					it(typeof test + ': ' + test, () => {
						expect(spy).not.toBeCalled();
					});
				});
			});

			it('should do # swapNodes calls and be in heap order after adding new lowest rank to end', () => {
				expect(instance.size()).toBe(ITEMS.length);
				instance.state.elements[instance.size()] = 1;
				// [10, 20, 60, 30, 50, 80, 70, 90, 40, 1] --> [1, 10, 60, 30, 20, 80, 70, 90, 40, 50]
				// 3 swapNode calls to fix
				instance.fixHeap(instance.size() - 1);
				expect(spy).toBeCalledTimes(3);
				expect(instance.state.elements).toStrictEqual([1, 10, 60, 30, 20, 80, 70, 90, 40, 50]);
			});

			it('should do # swapNodes calls and be in heap order after adding middle value rank to end', () => {
				expect(instance.size()).toBe(ITEMS.length);
				instance.state.elements[instance.size()] = 45;
				// [10, 20, 60, 30, 50, 80, 70, 90, 40, 45] --> [10, 20, 60, 30, 45, 80, 70, 90, 40, 50]
				// 1 swapNode calls to fix
				instance.fixHeap(instance.size() - 1);
				expect(spy).toBeCalledTimes(1);
				expect(instance.state.elements).toStrictEqual([10, 20, 60, 30, 45, 80, 70, 90, 40, 50]);
			});

			it('should do # swapNodes calls and be in heap order after adding new highest rank to end', () => {
				expect(instance.size()).toBe(ITEMS.length);
				instance.state.elements[instance.size()] = 100;
				// [10, 20, 60, 30, 50, 80, 70, 90, 40, 100] --> [10, 20, 60, 30, 50, 80, 70, 90, 40, 100]
				// 0 swapNode calls to fix
				instance.fixHeap(instance.size() - 1);
				expect(spy).toBeCalledTimes(0);
				expect(instance.state.elements).toStrictEqual([10, 20, 60, 30, 50, 80, 70, 90, 40, 100]);
			});

			it('should do # swapNodes calls and be in heap order after adding new lowest rank to beginning', () => {
				expect(instance.size()).toBe(ITEMS.length);
				instance.state.elements[0] = 1;
				// [1, 20, 60, 30, 50, 80, 70, 90, 40] --> [1, 20, 60, 30, 50, 80, 70, 90, 40]
				// 0 swapNode calls to fix
				instance.fixHeap(0);
				expect(spy).toBeCalledTimes(0);
				expect(instance.state.elements).toStrictEqual([1, 20, 60, 30, 50, 80, 70, 90, 40]);
			});

			it('should do # swapNodes calls and be in heap order after adding middle value rank to beginning', () => {
				expect(instance.size()).toBe(ITEMS.length);
				instance.state.elements[0] = 35;
				// [55, 20, 60, 30, 50, 80, 70, 90, 40] --> [20, 30, 60, 40, 50, 80, 70, 90, 55]
				// 2 swapNode calls to fix
				instance.fixHeap(0);
				expect(spy).toBeCalledTimes(2);
				expect(instance.state.elements).toStrictEqual([20, 30, 60, 35, 50, 80, 70, 90, 40]);
			});

			it('should do # swapNodes calls and be in heap order after adding new highest rank to beginning', () => {
				expect(instance.size()).toBe(ITEMS.length);
				instance.state.elements[0] = 99;
				// [99, 20, 60, 30, 50, 80, 70, 90, 40] --> [20, 30, 60, 40, 50, 80, 70, 90, 99]
				// 3 swapNode calls to fix
				instance.fixHeap(0);
				expect(spy).toBeCalledTimes(3);
				expect(instance.state.elements).toStrictEqual([20, 30, 60, 40, 50, 80, 70, 90, 99]);
			});
		});

		describe('getChildNodesIndexes', () => {
			beforeEach(() => {
				ITEMS.forEach((item) => {
					instance.push(item);
				});
			});

			afterEach(() => {
				instance.clearElements();
			});

			it('should return {left: null, right: null} if null is passed', () => {
				expect(instance.getChildNodesIndexes(null)).toStrictEqual({left: null, right: null});
				expect(instance.getChildNodesIndexes(undefined!)).toStrictEqual({left: null, right: null});
			});

			it('should return {left: null, right: null} if a negative number is passed', () => {
				expect(instance.getChildNodesIndexes(-1)).toStrictEqual({left: null, right: null});
				expect(instance.getChildNodesIndexes(-99)).toStrictEqual({left: null, right: null});
			});

			it('should return {left: null, right: null} if a float is paseed', () => {
				expect(instance.getChildNodesIndexes(Math.PI)).toStrictEqual({left: null, right: null});
			});

			it('should return {left: null, right: null} if the index passed is outside the aray', () => {
				expect(instance.getChildNodesIndexes(instance.size() * 2)).toStrictEqual({left: null, right: null});
			});

			it('should return {left: null, right: null} if the result would be outside the array', () => {
				expect(instance.getChildNodesIndexes(instance.size() - 1)).toStrictEqual({left: null, right: null});
			});

			it('should return the children of a valid node in the form of {left: number | null, right: number | null}', () => {
				expect(instance.getChildNodesIndexes(0)).toStrictEqual({left: 1, right: 2});
				expect(instance.getChildNodesIndexes(1)).toStrictEqual({left: 3, right: 4});
				expect(instance.getChildNodesIndexes(2)).toStrictEqual({left: 5, right: 6});
				expect(instance.getChildNodesIndexes(3)).toStrictEqual({left: 7, right: 8});
				expect(instance.getChildNodesIndexes(4)).toStrictEqual({left: null, right: null});
				expect(instance.getChildNodesIndexes(5)).toStrictEqual({left: null, right: null});
				expect(instance.getChildNodesIndexes(6)).toStrictEqual({left: null, right: null});
				expect(instance.getChildNodesIndexes(7)).toStrictEqual({left: null, right: null});
				expect(instance.getChildNodesIndexes(8)).toStrictEqual({left: null, right: null});
			});

			it('should return the children of a valid node before and after a push that moves node', () => {
				expect(instance.state.elements[1]).toBe(20);
				expect(instance.getChildNodesIndexes(1)).toStrictEqual({left: 3, right: 4});
				instance.push(15);
				expect(instance.state.elements[1]).toBe(15);
				expect(instance.state.elements[4]).toBe(20);
				expect(instance.getChildNodesIndexes(4)).toStrictEqual({left: 9, right: null});
			});

			it('should return the children of a valid node before and after a pop that moves node', () => {
				expect(instance.state.elements[1]).toBe(20);
				expect(instance.getChildNodesIndexes(1)).toStrictEqual({left: 3, right: 4});
				instance.pop();
				expect(instance.state.elements[1]).toBe(30);
				expect(instance.state.elements[0]).toBe(20);
				expect(instance.getChildNodesIndexes(0)).toStrictEqual({left: 1, right: 2});
			});
		});

		describe('getNextIndex', () => {
			let spyChildren;
			let spyParent;

			beforeAll(() => {
				spyChildren = jest.spyOn(instance, 'getChildNodesIndexes');
				spyParent = jest.spyOn(instance, 'getParentNodeIndex');
			});

			beforeEach(() => {
				ITEMS.forEach((item) => {
					instance.push(item);
				});
				spyChildren.mockClear();
				spyParent.mockClear();
			});

			afterEach(() => {
				instance.clearElements();
			});

			afterAll(() => {
				spyChildren.mockRestore();
				spyParent.mockRestore();
			});

			it('should call getParentNodeIndex and not call getChildNodesIndexes if startFromTop is false', () => {
				expect(spyParent).not.toBeCalled();
				expect(spyChildren).not.toBeCalled();

				instance.getNextIndex(false, 1);

				expect(spyParent).toBeCalledTimes(1);
				expect(spyChildren).toBeCalledTimes(0);
			});

			it('should call getChildNodesIndexes and not call getParentNodeIndex if startFromTop is true', () => {
				expect(spyParent).not.toBeCalled();
				expect(spyChildren).not.toBeCalled();

				instance.getNextIndex(true, 1);

				expect(spyParent).toBeCalledTimes(0);
				expect(spyChildren).toBeCalledTimes(1);
			});

			it('should return null if leftIndex is null', () => {
				expect(spyParent).not.toBeCalled();
				expect(spyChildren).not.toBeCalled();

				const expectedV = null;
				spyChildren.mockReturnValueOnce({left: null, right: null});

				expect(instance.getNextIndex(true, 8)).toBe(expectedV);
				expect(spyChildren).toBeCalledTimes(1);
			});

			it('should return leftIndex if rightIndex is null', () => {
				expect(spyParent).not.toBeCalled();
				expect(spyChildren).not.toBeCalled();

				const expectedV = 12345;
				spyChildren.mockReturnValueOnce({left: expectedV, right: null});
				expect(instance.getNextIndex(true, 4)).toBe(expectedV);

				expect(spyParent).not.toBeCalled();
				expect(spyChildren).toBeCalledTimes(1);
			});

			it('should return leftIndex if elements[rightIndex] is null', () => {
				expect(spyParent).not.toBeCalled();
				expect(spyChildren).not.toBeCalled();

				const expectedV = 23456;
				instance.state.elements = [1, null!];
				spyChildren.mockReturnValueOnce({left: expectedV, right: 1});
				expect(instance.getNextIndex(true, 0)).toBe(expectedV);

				expect(spyParent).not.toBeCalled();
				expect(spyChildren).toBeCalledTimes(1);
			});

			it('should return rightIndex if elements[leftIndex] is null', () => {
				expect(spyParent).not.toBeCalled();
				expect(spyChildren).not.toBeCalled();

				const expectedV = 34567;
				instance.state.elements = [null!, 1];
				spyChildren.mockReturnValueOnce({left: 0, right: expectedV});
				expect(instance.getNextIndex(true, 0)).toBe(expectedV);

				expect(spyParent).not.toBeCalled();
				expect(spyChildren).toBeCalledTimes(1);
			});

			it('should return leftIndex if elements[leftIndex] < elements[rightIndex]', () => {
				expect(spyParent).not.toBeCalled();
				expect(spyChildren).not.toBeCalled();

				const expectedV = 45678;
				instance.state.elements[expectedV] = 1;
				instance.state.elements[1] = 2;
				spyChildren.mockReturnValueOnce({left: expectedV, right: 1});
				expect(instance.getNextIndex(true, 0)).toBe(expectedV);

				expect(spyParent).not.toBeCalled();
				expect(spyChildren).toBeCalledTimes(1);
			});

			it('should return rightIndex if elements[leftIndex] > elements[rightIndex]', () => {
				expect(spyParent).not.toBeCalled();
				expect(spyChildren).not.toBeCalled();

				const expectedV = 56789;
				instance.state.elements[0] = 2;
				instance.state.elements[expectedV] = 1;
				spyChildren.mockReturnValueOnce({left: 0, right: expectedV});
				expect(instance.getNextIndex(true, 0)).toBe(expectedV);

				expect(spyParent).not.toBeCalled();
				expect(spyChildren).toBeCalledTimes(1);
			});
		});

		describe('getParentNodeIndex', () => {
			beforeEach(() => {
				ITEMS.forEach((item) => {
					instance.push(item);
				});
			});

			afterEach(() => {
				instance.clearElements();
			});

			it('should return null if null or underfined is passed', () => {
				expect(instance.getParentNodeIndex(null)).toBeNull();
				expect(instance.getParentNodeIndex(undefined!)).toBeNull();
			});

			it('should return null if 0 or less is passed', () => {
				expect(instance.getParentNodeIndex(0)).toBeNull();
				expect(instance.getParentNodeIndex(-1)).toBeNull();
				expect(instance.getParentNodeIndex(-99)).toBeNull();
			});

			it('should return null if a float is passed', () => {
				expect(instance.getParentNodeIndex(Math.PI)).toBeNull();
			});

			it('should return null if the index passed is larger than the aray', () => {
				expect(instance.getParentNodeIndex(instance.size() * 2)).toBeNull();
			});

			it('should return the parent of a valid node if the parent is valid', () => {
				expect(instance.getParentNodeIndex(0)).toBeNull();
				expect(instance.getParentNodeIndex(1)).toBe(0);
				expect(instance.getParentNodeIndex(2)).toBe(0);
				expect(instance.getParentNodeIndex(3)).toBe(1);
				expect(instance.getParentNodeIndex(4)).toBe(1);
				expect(instance.getParentNodeIndex(5)).toBe(2);
				expect(instance.getParentNodeIndex(6)).toBe(2);
				expect(instance.getParentNodeIndex(7)).toBe(3);
			});

			it('should return the parent of a valid node before and after a push that moves node', () => {
				expect(instance.state.elements[4]).toBe(50);
				expect(instance.getParentNodeIndex(4)).toBe(1);
				instance.push(45);
				expect(instance.state.elements[4]).toBe(45);
				expect(instance.state.elements[9]).toBe(50);
				expect(instance.getParentNodeIndex(9)).toBe(4);
			});

			it('should return the parent of a valid node before and after a pop that moves node', () => {
				expect(instance.state.elements[3]).toBe(30);
				expect(instance.getParentNodeIndex(3)).toBe(1);
				instance.pop();
				expect(instance.state.elements[3]).toBe(40);
				expect(instance.state.elements[1]).toBe(30);
				expect(instance.getParentNodeIndex(1)).toBe(0);
			});
		});

		describe('isHeapSorted', () => {
			it('should run areNodesValidHeap once per node that has a child', () => {
				ITEMS.forEach((item) => {
					instance.push(item);
				});

				let expectedV = 0;
				instance.state.elements.forEach((e, index) => {
					let children = instance.getChildNodesIndexes(index);
					if (children.left !== null || children.right !== null) {
						expectedV++;
					}
				});

				const spy = jest.spyOn(instance, 'areNodesValidHeap');
				expect(spy).not.toBeCalled();

				instance.isHeapSorted();
				expect(spy).toBeCalledTimes(expectedV);

				spy.mockRestore();
			});
		});

		describe('heapify', () => {
			beforeEach(() => {
				const list: number[] = [];
				for (let i = 0; i < 50; i++) {
					let random = Math.floor(Math.random() * 999);
					list.push(random);
				}
				instance.state.elements = list;
			});

			it('should run fixHeap once per node that has a child', () => {
				let expectedV = 0;
				instance.state.elements.forEach((e, index) => {
					let children = instance.getChildNodesIndexes(index);
					if (children.left !== null || children.right !== null) {
						expectedV++;
					}
				});

				const spy = jest.spyOn(instance, 'fixHeap');
				expect(spy).not.toBeCalled();

				instance.heapify();
				expect(spy).toBeCalledTimes(expectedV);

				spy.mockRestore();
			});

			it('should sort the heap', () => {
				instance.heapify();
				expect(instance.isHeapSorted()).toBe(true);
			});
		});

		describe('swapNodes', () => {
			let unchanged: ADTPriorityQueue<number>;

			beforeAll(() => {
				unchanged = new ADTPriorityQueue<number>(comparator);
			});

			beforeEach(() => {
				instance.reset();
				unchanged.reset();
			});

			describe('should do nothing if', () => {
				const tests = ([1] as any).concat(NAN_VALUES, FLOAT_VALUES, NEG_INT_VALUES);
				tests.forEach((param1) => {
					tests.forEach((param2) => {
						if (param1 === 1 && param2 === 1) {
							it('indexOne === indexTwo', () => {
								ITEMS.forEach((item) => {
									instance.push(item);
									unchanged.push(item);
								});
								instance.swapNodes(param1, param2);
								expect(instance.state.elements).toStrictEqual(unchanged.state.elements);
							});
						}
						it(`${typeof param1}: ${param1} & ${typeof param2}: ${param2}`, () => {
							ITEMS.forEach((item) => {
								instance.push(item);
								unchanged.push(item);
							});
							instance.swapNodes(param1, param2);
							expect(instance.state.elements).toStrictEqual(unchanged.state.elements);
						});
					});
				});
			});

			it('should swap the order of the items', () => {
				ITEMS.forEach((item) => {
					instance.push(item);
				});

				/**
				 * start: 10, 20, 60, 30, 50, 80, 70, 90, 40
				 * swap1: 10, 20, 60, 70, 50, 80, 30, 90, 40
				 * swap2: 10, 70, 60, 20, 50, 80, 30, 90, 40
				 */

				expect(instance.state.elements).toStrictEqual([10, 20, 60, 30, 50, 80, 70, 90, 40]);
				instance.swapNodes(3, 6);
				expect(instance.state.elements).toStrictEqual([10, 20, 60, 70, 50, 80, 30, 90, 40]);
				instance.swapNodes(1, 3);
				expect(instance.state.elements).toStrictEqual([10, 70, 60, 20, 50, 80, 30, 90, 40]);
			});

			it('should move all properties of indexOne to indexTwo and vice-versa', () => {
				const complexitems1 = [{depth1: {depth2: 10}}, {depth1: {depth2: 20}}, {depth1: {depth2: 30}}];
				const complexitems2 = [{depth1: {depth2: 10}}, {depth1: {depth2: 20}}, {depth1: {depth2: 30}}];

				const deepSwapped = new ADTPriorityQueue<any>((a, b) => false, {
					elements: complexitems1
				});
				const deepUnchanged = new ADTPriorityQueue<any>((a, b) => false, {
					elements: complexitems2
				});

				deepSwapped.swapNodes(0, 1);
				expect(deepSwapped.state.elements[0]).toStrictEqual(deepUnchanged.state.elements[1]);
				expect(deepSwapped.state.elements[1]).toStrictEqual(deepUnchanged.state.elements[0]);
				expect(deepSwapped[0] === deepUnchanged[1]).toBeTruthy();
				expect(deepSwapped[1] === deepUnchanged[0]).toBeTruthy();
				deepSwapped.swapNodes(1, 2);
				expect(deepSwapped.state.elements[2]).toStrictEqual(deepUnchanged.state.elements[0]);
				expect(deepSwapped.state.elements[1]).toStrictEqual(deepUnchanged.state.elements[2]);
				expect(deepSwapped[2] === deepUnchanged[0]).toBeTruthy();
				expect(deepSwapped[1] === deepUnchanged[2]).toBeTruthy();
			});
		});
	});

	describe('Implementation', () => {
		describe('clearElements', () => {
			it('should not throw when priority queue is empty', () => {
				expect(instance.size()).toBe(0);
				expect(() => {
					instance.clearElements();
				}).not.toThrow();
			});

			it('should remove item from priority queue when size is 1', () => {
				expect(instance.size()).toBe(0);

				instance.push(Math.floor(Math.random() * 999));
				expect(instance.size()).toBe(1);

				instance.clearElements();
				expect(instance.size()).toBe(0);
			});

			it('should remove all items from priority queue', () => {
				expect(instance.size()).toBe(0);
				let limit = 5;

				for (let i = 0; i < limit; i++) {
					instance.push(Math.floor(Math.random() * 999));
				}
				expect(instance.size()).toBe(limit);

				instance.clearElements();
				expect(instance.size()).toBe(0);
			});
		});

		describe('front', () => {
			it('should return null when priority queue size is 0', () => {
				expect(instance.size()).toBe(0);
				expect(instance.front()).toBeNull();
			});

			it('should return the only item when the size is 1', () => {
				const expectedV = 13579;
				instance.push(expectedV);
				expect(instance.size()).toBe(1);
				expect(instance.front()).toStrictEqual(expectedV);
			});

			it('should return the item with the lowest rank in priority queue', () => {
				ITEMS.forEach((item) => {
					instance.push(item);
				});
				const expectedV = ITEMS.slice().sort((a, b) => a - b)[0];
				expect(instance.front()).toStrictEqual(expectedV);
			});
		});

		describe('push', () => {
			it('should add exactly one item to priority queue when push is called once', () => {
				expect(instance.size()).toBe(0);
				instance.push(1);
				expect(instance.size()).toBe(1);
			});

			it('should add exactly 15 items to priority queue when push is called 15 times', () => {
				expect(instance.size()).toBe(0);

				const limit = 15;
				for (let i = 0; i < limit; i++) {
					instance.push(Math.floor(Math.random() * 999));
				}

				expect(instance.size()).toBe(limit);
			});

			it('should return the pq', () => {
				expect(instance.size()).toBe(0);

				expect(instance.push(1)).toBe(instance);
				expect(instance.size()).toBe(1);

				expect(instance.push(2).push(3)).toBe(instance);
				expect(instance.size()).toBe(3);
			});
		});

		describe('pop', () => {
			it('should remove exactly 1 item from the priority queue when pop is called once', () => {
				const limit = 12;
				for (let i = 0; i < limit; i++) {
					instance.push(Math.floor(Math.random() * 999));
				}
				expect(instance.size()).toBe(limit);
				instance.pop();
				expect(instance.size()).toBe(limit - 1);
			});

			it('should return null when called on a priority queue of size 0', () => {
				expect(instance.size()).toBe(0);
				expect(instance.pop()).toBeNull();
			});

			it('should return null when called repeatedly on a priority queue of size 0', () => {
				expect(instance.size()).toBe(0);

				for (let i = 0; i < 5; i++) {
					expect(instance.pop()).toBeNull();
				}
			});

			it('should return the only element and then null when called twice on a pq of size 1', () => {
				instance.push(1);
				expect(instance.size()).toBe(1);

				expect(instance.pop()).toBe(1);
				expect(instance.pop()).toBeNull();
			});

			it('should return first item in priority queue', () => {
				const limit = 15;
				let expectedV = 99999;

				for (let i = 0; i < limit; i++) {
					let random = Math.floor(Math.random() * 999);
					if (random < expectedV) expectedV = random;
					instance.push(random);
				}

				let result = instance.pop();
				expect(result).not.toBeNull();
				if (result) expect(result).toBe(expectedV);
			});

			it('should pop items in rank order from priority queue', () => {
				const limit = 15;
				let expectedV: Array<number> = [];

				for (let i = 0; i < limit; i++) {
					let random = Math.floor(Math.random() * 999);
					expectedV.push(random);
					instance.push(random);
				}

				expectedV.sort((a, b) => a - b);

				for (let i = 0; i < limit; i++) {
					let result = instance.pop();
					expect(result).not.toBeNull();
					if (result) expect(result).toBe(expectedV[i]);
				}
			});

			it('should return all items from the list and then return null when called size + 1 times', () => {
				const limit = 5;

				for (let i = 0; i < limit; i++) {
					instance.push(Math.floor(Math.random() * 999));
				}

				for (let i = 0; i < limit; i++) {
					expect(instance.pop()).not.toBeNull();
				}

				expect(instance.pop()).toBeNull();
			});
		});

		describe('query', () => {});

		describe('reset', () => {
			it('should not throw if state has errors', () => {
				instance.state.elements = '' as any;
				expect(() => {
					instance.reset();
				}).not.toThrow();
			});

			it('should return the pq', () => {
				expect(instance.reset()).toBe(instance);
			});

			it('should call clearElements', () => {
				const spy = jest.spyOn(instance, 'clearElements');
				expect(spy).not.toBeCalled();

				instance.reset();
				expect(spy).toBeCalled();
			});
		});

		describe('size', () => {
			it('should return 0 if elements is missing', () => {
				instance.state.elements = undefined!;
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
			describe('should return null if state is invalid', () => {
				const custom = new ADTPriorityQueue<number>(comparator);
				STATE_PROPERTIES.forEach((type) => {
					it(typeof type + ': ' + type, () => {
						custom.reset();
						custom.state[type] = null as any;
						expect(custom.stringify()).toBeNull();
					});
				});
			});

			it('should return the state as a string if it is validated', () => {
				const custom = new ADTPriorityQueue<number>(comparator);
				expect(JSON.parse(custom.stringify()!)).toStrictEqual({
					type: 'pqState',
					elements: []
				});

				custom.push(30);
				expect(JSON.parse(custom.stringify()!)).toStrictEqual({
					type: 'pqState',
					elements: [30]
				});

				custom.push(20);
				expect(JSON.parse(custom.stringify()!)).toStrictEqual({
					type: 'pqState',
					elements: [20, 30]
				});

				custom.push(10);
				expect(JSON.parse(custom.stringify()!)).toStrictEqual({
					type: 'pqState',
					elements: [10, 30, 20]
				});
			});
		});
	});
});
