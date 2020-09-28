import ADTLinkedList from '../src/linked-list/linked-list';
import ADTLinkedListElement from '../src/linked-list/linked-list-element';
import ADTLinkedListState from '../src/linked-list/linked-list-state';
import ADTQueryFilter from '../src/query/query-filter';
import ADTQueryOptions from '../src/query/query-options';
import ADTQueryResult from '../src/query/query-result';

describe('ADTLinkedList', () => {
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

	const STATE_PROPERTIES = ['type', 'elements', 'objectPool'];
	const VALID_SERIALIZED_STATE = [
		'{',
		'"type": "llState",',
		'"elements": [1,2],',
		'"objectPool": true,',
		'"size": 2,',
		'"head": null,',
		'"tail": null',
		'}'
	].join('');
	const DEFAULT_STATE: ADTLinkedListState<number> = {
		type: 'llState',
		elements: [],
		objectPool: false,
		size: 0,
		head: null,
		tail: null
	};

	const ITEMS = [90, 70, 50, 30, 10, 80, 60, 40, 20];

	const queryFilter = function (target: number): ADTQueryFilter {
		const filter: ADTQueryFilter = (element): boolean => {
			return element === target;
		};

		return filter;
	};
	const getList = function (obj: ADTLinkedList<number>) {
		const list: Array<number> = [];

		obj.forEach((elem) => {
			let value = elem.value();
			if (value) {
				list.push(value);
			}
		});

		return list;
	};

	let instance: ADTLinkedList<number>;

	beforeAll(() => {
		instance = new ADTLinkedList<number>();
	});

	beforeEach(() => {
		instance.reset();
	});

	describe('Constructor', () => {
		describe('constructor', () => {
			it('should initialize _head to null when no elements argument provided', () => {
				const custom = new ADTLinkedList<number>();
				expect(custom.state.head).toBeNull();
			});

			it('should initialize _tail to null when no elements argument provided', () => {
				const custom = new ADTLinkedList<number>();
				expect(custom.state.tail).toBeNull();
			});

			it('should initialize list with provided single element', () => {
				const expectedValue = 66182;
				const custom = new ADTLinkedList<number>({elements: [expectedValue]});
				expect(custom!.head()!.value()).toBe(expectedValue);
			});

			it('should initialize list length to 1 when elements argument is a single element', () => {
				const expectedValue = 32145;
				const custom = new ADTLinkedList<number>({elements: [expectedValue]});
				expect(custom.state.size).toBe(1);
			});

			it('should initialize list with elements array argument', () => {
				const elements = [331, 441, 551, 323, 333];
				const custom = new ADTLinkedList<number>({elements: elements});

				let curr = custom.head();
				elements.forEach((element: number) => {
					if (!curr) {
						return;
					}
					expect(curr.value()).toBe(element);
					curr = curr.next();
				});

				expect(custom!.head()!.value()).toBe(elements[0]);
				expect(custom!.tail()!.value()).toBe(elements[elements.length - 1]);
			});

			it('should initialize with serializedState', () => {
				const custom = new ADTLinkedList<number>({serializedState: VALID_SERIALIZED_STATE});
				expect(JSON.parse(custom.stringify()!)).toStrictEqual(JSON.parse(VALID_SERIALIZED_STATE));
			});

			it('should initialize with other options overriding serializedState if they are valid', () => {
				const expectedV: ADTLinkedListState<number> = JSON.parse(VALID_SERIALIZED_STATE);
				expectedV.elements = [3, 4];

				const custom = new ADTLinkedList<number>({
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
				expectedV.size = 0;

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

			it('should return serializedState as ADTLinkedListState if it is valid', () => {
				const expectedV = JSON.parse(VALID_SERIALIZED_STATE);
				expectedV.size = 0;

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

			const toParseList = ['{}', '{"type": "llState"}', '{"elements":4, "type": "llState"}'];
			it.each(toParseList)('should return errors, %p wont parse into an ADTLinkedListState', (toParse) => {
				let errors: Array<string> = [];
				errors = instance.getStateErrors(JSON.parse(toParse) as any);
				errors.unshift('state is not a valid ADTLinkedListState');
				expect(instance.parseOptionsStateString(toParse)).toStrictEqual(errors);
			});

			it('should return an ADTLinkedListState when a parsable string is passed', () => {
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
				const expectedV: ADTLinkedListState<number> = {...DEFAULT_STATE};
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
					result: 'not "llState"',
					testSuite: ([] as any).concat([null, undefined, '', 'state']),
					expectedV: 'state type must be llState'
				},
				{
					prop: 'elements',
					result: 'not an array',
					testSuite: ([] as any).concat([{}, null, undefined, '', 'teststring']),
					expectedV: 'state elements must be an array'
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

		describe('queryDelete', () => {
			let queryResult: ADTQueryResult<ADTLinkedListElement<number>>;

			beforeEach(() => {
				ITEMS.forEach((item) => {
					instance.insert(item);
				});
			});

			afterEach(() => {
				instance.clearElements();
				queryResult = null as any;
			});

			it('should return the value of the element if it is in ll', () => {
				let expectedSize = ITEMS.length;
				expect(instance.state.size).toBe(expectedSize);

				let query = instance.head()!.value();
				let queryResults = instance.query(queryFilter(query!));
				expect(queryResults.length).toBe(1);
				queryResult = queryResults[0];

				expect(instance.queryDelete(queryResult)).toBe(queryResult.element.value());
			});

			it('should delete the element from ll', () => {
				let expectedSize = ITEMS.length;
				expect(instance.state.size).toBe(expectedSize);

				let query = instance.head()!.value();
				let queryResults = instance.query(queryFilter(query!));
				expect(queryResults.length).toBe(1);
				queryResult = queryResults[0];

				instance.queryDelete(queryResult);
				expect(instance.state.size).toBe(expectedSize - 1);
			});

			it('should stitch the linked list back together', () => {
				let expectedSize = ITEMS.length;
				expect(instance.state.size).toBe(expectedSize);

				let query = instance.head()!.next()!.value();
				let queryResults = instance.query(queryFilter(query!));
				queryResult = queryResults[0];

				instance.queryDelete(queryResult);
				expect(getList(instance)).toEqual(ITEMS.slice(0, 1).concat(ITEMS.slice(2)));
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
			it('should set _head to null', () => {
				instance.insert(55019);
				expect(instance.state.head).not.toBeNull();
				instance.clearElements();
				expect(instance.state.head).toBeNull();
			});

			it('should set _tail to null', () => {
				instance.insert(66019);
				expect(instance.state.tail).not.toBeNull();
				instance.clearElements();
				expect(instance.state.tail).toBeNull();
			});

			it('should set length to 0', () => {
				instance.insert(66019);
				instance.insert(11102);
				expect(instance.state.size).toBe(2);
				instance.clearElements();
				expect(instance.state.size).toBe(0);
			});

			it('should return the linked list instance', () => {
				const result = instance.clearElements();
				expect(result instanceof ADTLinkedList).toBe(true);
				expect(result).toBe(instance);
			});
		});

		describe('forEach', () => {
			let testSuite = [
				[['insert']],
				[['insert', 'insert']],
				[['insert', 'insert', 'pop']],
				[['insert', 'insert', 'pop', 'insert', 'insert', 'insert', 'insert']]
			];

			it.each(testSuite)('should loop through all after %p', (myTest) => {
				let insertCount = 0;
				myTest.forEach((func) => {
					if (func === 'insert') {
						insertCount++;
						instance.insert(insertCount);
					} else {
						instance.queryDelete({element: instance.tail()} as any);
					}
				});

				let expectedV = myTest.join('');
				let expectedCount = instance.state.size;
				let count = 0;

				instance.forEach((elem, index) => {
					count++;
					elem.value(expectedV as any);
				});
				expect(count).toBe(expectedCount);
				expect(instance.head()!.value()).toBe(expectedV);
				expect(instance.tail()!.value()).toBe(expectedV);
			});
		});

		describe('head', () => {
			it('should return null on empty list', () => {
				expect(instance.state.size).toBe(0);
				expect(instance.head()).toBeNull();
			});
		});

		describe('insert', () => {
			let spy;
			beforeAll(() => {
				spy = jest.spyOn(instance, 'insertAtTail');
			});

			beforeEach(() => {
				spy.mockReset();
			});

			afterAll(() => {
				spy.mockRestore();
			});

			it('should pass element argument to insertAtTail method', () => {
				expect(spy).not.toHaveBeenCalled();
				const expectedValue = 110924;
				instance.insert(expectedValue);
				expect(spy).toHaveBeenCalledWith(expectedValue);
			});

			it('should call insertAtTail once', () => {
				expect(spy).not.toHaveBeenCalled();
				const expectedValue = 332143;

				instance.insert(expectedValue);
				expect(spy).toHaveBeenCalledTimes(1);
			});
		});

		describe('insertAtHead', () => {
			it('should increase length by 1', () => {
				expect(instance.state.size).toBe(0);
				instance.insertAtHead(777182);
				expect(instance.state.size).toBe(1);
			});

			it('should increase length by 1 for each element inserted', () => {
				expect(instance.state.size).toBe(0);

				instance.insertAtHead(321555);
				instance.insertAtHead(33221345);
				instance.insertAtHead(4421333);
				expect(instance.state.size).toBe(3);
			});

			it('should set tail on the first element inserted', () => {
				expect(instance.state.size).toBe(0);
				const expectedValue = 232171;
				instance.insertAtHead(expectedValue);
				expect(instance!.tail()!.value()).toBe(expectedValue);
			});

			it('should set head to the last element inserted', () => {
				expect(instance.state.size).toBe(0);
				const expectedValue = 3321495;
				const elements = [expectedValue, 44109, 44092, 99201, 55510];
				elements.forEach((element: number) => {
					instance.insertAtHead(element);
					expect(instance!.head()!.value()).toBe(element);
				});
			});

			it('should not change tail on a non-empty list', () => {
				expect(instance.state.size).toBe(0);
				const expectedValue = 220190;
				instance.insert(expectedValue);
				const elements = [2093, 40912, 4001];
				elements.forEach((element: number) => {
					instance.insertAtHead(element);
					expect(instance!.tail()!.value()).toBe(expectedValue);
				});
			});
		});

		describe('insertAtTail', () => {
			it('should increase length by 1', () => {
				expect(instance.state.size).toBe(0);
				instance.insertAtTail(144091);
				expect(instance.state.size).toBe(1);
			});

			it('should increase length by 1 for each element added', () => {
				expect(instance.state.size).toBe(0);

				instance.insertAtTail(5511091);
				instance.insertAtTail(1109415);
				instance.insertAtTail(3211095);
				expect(instance.state.size).toBe(3);
			});

			it('should set head to first element added', () => {
				expect(instance.state.size).toBe(0);
				const expectedValue = 9481102;
				instance.insertAtTail(expectedValue);
				instance.insertAtTail(441092);
				instance.insertAtTail(889102);
				expect(instance!.head()!.value()).toBe(expectedValue);
			});

			it('should set tail to last element added', () => {
				expect(instance.state.size).toBe(0);
				const expectedValue = 5512231;
				instance.insertAtTail(4921322);
				instance.insertAtTail(3341438);
				instance.insertAtTail(expectedValue);
				expect(instance!.tail()!.value()).toBe(expectedValue);
			});

			it('should not change head when elements are appended', () => {
				expect(instance.state.size).toBe(0);

				const expectedValue = 18272;
				const elements = [expectedValue, 1221, 1331, 14441];
				elements.forEach((element: number) => {
					instance.insertAtTail(element);
					expect(instance!.head()!.value()).toBe(expectedValue);
				});
			});

			it('should change tail each time a new element appended', () => {
				expect(instance.state.size).toBe(0);

				const elements = [1141, 1221, 1331, 14441];
				elements.forEach((element: number) => {
					instance.insertAtTail(element);
					expect(instance!.tail()!.value()).toBe(element);
				});
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
					instance.insert(item);
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
				expect(instance.state.size).toBe(expectedSize);
				expect(instance.query([])).toEqual([]);
			});

			it('should return all elements matching filter', () => {
				let expectedSize = ITEMS.length;
				expect(instance.state.size).toBe(expectedSize);
				let query = 15;
				expect(instance.query(queryFilter(query)).length).toBe(0);

				let expectedV = 3;
				for (let i = 0; i < expectedV; i++) {
					instance.insert(query);
				}

				expect(instance.query(queryFilter(query)).length).toBe(expectedV);
			});

			it('should return all elements matching filter up to limit', () => {
				let expectedSize = ITEMS.length;
				expect(instance.state.size).toBe(expectedSize);
				let query = 45;
				expect(instance.query(queryFilter(query)).length).toBe(0);

				let expectedV = 2;
				for (let i = 0; i < expectedV * 2; i++) {
					instance.insert(query);
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

				let result = instance.query([customFilter(60, true), customFilter(30, false)]);
				expect(result.length).toBe(2);
				let resultValues: number[] = [];
				result.forEach((res) => {
					resultValues.push(res.element.value()!);
				});
				resultValues.sort((a, b) => a - b);
				expect(resultValues).toEqual([40, 50]);
			});
		});

		describe('reset', () => {
			it('should call clearElements', () => {
				const spy = jest.spyOn(instance, 'clearElements');
				expect(spy).not.toBeCalled();

				instance.reset();
				expect(spy).toBeCalled();
			});

			it('should remove all data from ll', () => {
				const custom = new ADTLinkedList<number>();

				custom.state.type = 'test' as any;

				custom.reset();

				expect(custom.state.type).toBe('llState');
			});
		});

		describe('reverse', () => {
			it('should return linked list instance when list is empty', () => {
				const result = instance.reverse();
				expect(result instanceof ADTLinkedList).toBe(true);
				expect(result).toBe(instance);
			});

			it('should return linked list instance when list is not empty', () => {
				instance.insert(11092);
				instance.insert(11440);
				instance.insert(99012);
				const result = instance.reverse();
				expect(result instanceof ADTLinkedList).toBe(true);
				expect(result).toBe(instance);
			});

			it('should reverse the order of the list', () => {
				const expectedV = [1, 2, 3, 4, 5];
				expectedV.forEach((elem) => {
					instance.insert(elem);
				});
				expect(getList(instance)).toEqual(expectedV);
				expectedV.reverse();
				instance.reverse();
				expect(getList(instance)).toEqual(expectedV);
			});
		});

		describe('stringify', () => {
			it('should return a stringified list of all elements', () => {
				const custom = new ADTLinkedList<number>({elements: [1, 2, 3]});
				const expectedV = {...DEFAULT_STATE};
				expectedV.elements = [1, 2, 3];
				expectedV.size = 3;

				expect(JSON.parse(custom.stringify()!)).toStrictEqual(expectedV);

				custom.insert(4);
				expectedV.elements.push(4);
				expectedV.size++;
				expect(JSON.parse(custom.stringify()!)).toStrictEqual(expectedV);

				custom.insertAtHead(0);
				expectedV.elements.unshift(0);
				expectedV.size++;
				expect(JSON.parse(custom.stringify()!)).toStrictEqual(expectedV);

				custom.clearElements();
				expectedV.elements.length = 0;
				expectedV.size = 0;
				expect(JSON.parse(custom.stringify()!)).toStrictEqual(expectedV);
			});
		});

		describe('tail', () => {
			it('should return null on empty list', () => {
				expect(instance.state.size).toBe(0);
				expect(instance.tail()).toBeNull();
			});
		});
	});
});
