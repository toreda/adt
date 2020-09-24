import ADTCircularQueue from '../src/circular-queue/circular-queue';
import ADTCircularQueueState from '../src/circular-queue/circular-queue-state';

describe('ADTCircularQueue', () => {
	let instance: ADTCircularQueue<number>;
	const items = [90, 70, 50, 30, 10, 80, 60, 40, 20];
	const maxSize = 4;

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

	let DEFAULT_STATE: ADTCircularQueueState<number>;
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

	beforeAll(() => {
		instance = new ADTCircularQueue<number>({maxSize: maxSize});
		DEFAULT_STATE = instance.getDefaultState();
	});

	beforeEach(() => {
		instance.reset();
	});

	describe('constructor', () => {
		it('should initialize with default state when no options are paseed', () => {
			const custom = new ADTCircularQueue<number>();
			expect(JSON.parse(custom.stringify()!)).toStrictEqual(DEFAULT_STATE);
		});

		it('should initialize with serializedState', () => {
			const custom = new ADTCircularQueue<number>({serializedState: VALID_SERIALIZED_STATE});
			expect(JSON.parse(custom.stringify()!)).toStrictEqual(JSON.parse(VALID_SERIALIZED_STATE));
		});

		it('should initialize with state settings overriding serializedState', () => {
			const expected1 = {...DEFAULT_STATE};
			expected1.maxSize = 2000;

			const custom1 = new ADTCircularQueue<number>({
				maxSize: expected1.maxSize
			});

			expect(JSON.parse(custom1.stringify()!)).toStrictEqual(expected1);

			const expected2 = JSON.parse(VALID_SERIALIZED_STATE);
			expected2.maxSize = 2000;

			const custom2 = new ADTCircularQueue<number>({
				serializedState: VALID_SERIALIZED_STATE,
				maxSize: expected2.maxSize
			});

			expect(JSON.parse(custom2.stringify()!)).toStrictEqual(expected2);
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
			const defaults = {...DEFAULT_STATE};

			expect(instance.parseOptions()).toStrictEqual(defaults);
			expect(instance.parseOptions(null!)).toStrictEqual(defaults);
			expect(instance.parseOptions(undefined!)).toStrictEqual(defaults);
			expect(instance.parseOptions({} as any)).toStrictEqual(defaults);
		});

		it('should return properties from parsed options', () => {
			const expected1 = JSON.parse(VALID_SERIALIZED_STATE);

			expect(
				instance.parseOptions({
					serializedState: VALID_SERIALIZED_STATE
				})
			).toStrictEqual(expected1);

			const expected2 = JSON.parse(VALID_SERIALIZED_STATE);
			expected2.maxSize = 999;

			expect(
				instance.parseOptions({
					serializedState: VALID_SERIALIZED_STATE,
					maxSize: expected2.maxSize
				})
			).toStrictEqual(expected2);
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

		it('should return serializedState as ADTCircularQueueState if it is valid', () => {
			const expected = JSON.parse(VALID_SERIALIZED_STATE);

			expect(
				instance.parseOptionsState({
					serializedState: VALID_SERIALIZED_STATE
				})
			).toStrictEqual(expected);
		});
	});

	describe('parseOptionsOther', () => {
		it('should return the default state if options is falsey', () => {
			expect(instance.parseOptionsOther(null!)).toStrictEqual(DEFAULT_STATE);
			expect(instance.parseOptionsOther('' as any)).toStrictEqual(DEFAULT_STATE);
			expect(instance.parseOptionsOther(undefined!)).toStrictEqual(DEFAULT_STATE);
		});

		it('should return passed state if options is null or undefined', () => {
			const types = [null, undefined];
			types.forEach((type) => {
				expect(instance.parseOptionsOther(instance.state, type!)).toStrictEqual(instance.state);
				expect(instance.parseOptionsOther(DEFAULT_STATE, type!)).toStrictEqual(DEFAULT_STATE);
				expect(instance.parseOptionsOther(instance.parse(VALID_SERIALIZED_STATE) as any, type!)).toStrictEqual(
					instance.parse(VALID_SERIALIZED_STATE)
				);
			});
		});

		it('should return passed state with values changed to match other passed options', () => {
			const expected: ADTCircularQueueState<number> = {...DEFAULT_STATE};
			expected.maxSize = 99;

			const result = instance.parseOptionsOther(DEFAULT_STATE, {
				maxSize: expected.maxSize
			});

			expect(result).toStrictEqual(expected);
		});

		it('should return passed state with values changed to match other passed options if those are valid', () => {
			const expected: ADTCircularQueueState<number> = {...DEFAULT_STATE};
			expected.maxSize = 99;

			const result = instance.parseOptionsOther(DEFAULT_STATE, {
				maxSize: expected.maxSize,
				size: -1
			});

			expect(result).toStrictEqual(expected);
		});
	});

	describe('wrapIndex', () => {
		describe('should return a value from 0 to maxSize - 1 when an integer is passed', () => {
			const indices = INT_VALUES.concat([maxSize - 1, maxSize, Math.round(maxSize * 3.5)]);
			indices.forEach((index) => {
				it(typeof index + ': ' + index, () => {
					const res = instance.wrapIndex(index);
					expect(res).toBeGreaterThanOrEqual(0);
					expect(res).toBeLessThan(instance.state.maxSize);
				});
			});
		});

		describe('should return -1 if value is not an integer', () => {
			const indices = ([] as any[]).concat(FLOAT_VALUES, NAN_VALUES);
			indices.forEach((index) => {
				it(typeof index + ': ' + index, () => {
					expect(instance.wrapIndex(index as any)).toBe(-1);
				});
			});
		});
	});

	describe('isEmpty', () => {
		isValidStateRuns((obj) => {
			obj.isEmpty();
		});

		it('should return true if state.size === 0', () => {
			instance.state.size = 0;
			expect(instance.isEmpty()).toBe(true);
		});

		it('should return false if state.size is > 0', () => {
			const sizes = [1, maxSize - 1, maxSize, maxSize * 2];
			sizes.forEach((size) => {
				instance.state.size = size;
				expect(instance.isEmpty()).toBe(false);
			});
		});

		describe('should return false if state.size is not an integer >= 0', () => {
			const sizes = ([] as any).concat(NAN_VALUES, FLOAT_VALUES, NEG_INT_VALUES);
			sizes.forEach((size) => {
				it(typeof size + ': ' + size, () => {
					instance.state.size = size!;
					expect(instance.isEmpty()).toBe(false);
				});
			});
		});
	});

	describe('isFull', () => {
		isValidStateRuns((obj) => {
			obj.isFull();
		});

		it('should return true if state.size >= maxSize', () => {
			const sizes = [maxSize, maxSize * 2];
			sizes.forEach((size) => {
				instance.state.size = size;
				expect(instance.isFull()).toBe(true);
			});
		});

		it('should return false if 0 <= state.size < maxSize ', () => {
			const sizes = [0, 1, instance.state.maxSize - 1];
			sizes.forEach((size) => {
				instance.state.size = size;
				expect(instance.isFull()).toBe(false);
			});
		});

		describe('should return false if state.size is not an integer >= 0', () => {
			const sizes = ([] as any).concat(NAN_VALUES, FLOAT_VALUES, NEG_INT_VALUES);
			sizes.forEach((size) => {
				it(typeof size + ': ' + size, () => {
					instance.state.size = size!;
					expect(instance.isFull()).toBe(false);
				});
			});
		});
	});

	describe('front', () => {
		isValidStateRuns((obj) => {
			obj.front();
		});

		describe('should return null if state.front is not an integer', () => {
			const indices = ([] as any).concat(NAN_VALUES, FLOAT_VALUES);
			indices.forEach((index) => {
				it(typeof index + ': ' + index, () => {
					instance.state.front = index!;
					expect(instance.front()).toBeNull();
				});
			});
		});

		it('should return null if state.size is 0', () => {
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
			instance.state.front = maxSize;
			expect(instance.front()).not.toBeNull();
			instance.state.front = Math.round(maxSize * 2.5);
			expect(instance.front()).not.toBeNull();
		});
	});

	describe('rear', () => {
		isValidStateRuns((obj) => {
			obj.rear();
		});

		describe('should return null if state.rear is not an integer', () => {
			const indices = ([] as any).concat(NAN_VALUES, FLOAT_VALUES);
			indices.forEach((index) => {
				it(typeof index + ': ' + index, () => {
					instance.state.rear = index!;
					expect(instance.rear()).toBeNull();
				});
			});
		});

		it('should return null if state.size is 0', () => {
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
			instance.state.rear = maxSize;
			expect(instance.rear()).not.toBeNull();
			instance.state.rear = Math.round(maxSize * 2.5);
			expect(instance.rear()).not.toBeNull();
		});
	});

	describe('getIndex', () => {
		isValidStateRuns((obj) => {
			obj.getIndex();
		});

		it('should return null if isValidState returns false', () => {
			instance.state.size = -1;
			expect(instance.getIndex(0)).toBeNull();
		});

		describe('should return null if index is not an integer', () => {
			const indices = ([] as any).concat(NAN_VALUES, FLOAT_VALUES);
			indices.forEach((index) => {
				it(typeof index + ': ' + index, () => {
					expect(instance.getIndex(index!)).toBeNull();
				});
			});
		});

		it('should return null if state.size is 0', () => {
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

	describe('push', () => {
		it('should run isValidState check', () => {
			const spy = jest.spyOn(instance, 'isValidState');

			spy.mockClear();
			instance.push(1);

			expect(spy).toBeCalled();
		});

		it('should return false if isValidState returns false', () => {
			instance.state.size = -1;
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
			expect(instance.state.size).toBe(0);
			expect(instance.state.front).toBe(0);
			expect(instance.state.rear).toBe(0);
			expect(instance.push(10)).toBe(true);
			expect(instance.state.front).toBe(0);
			expect(instance.state.size).toBe(1);
			expect(instance.state.rear).toBe(1);
			expect(instance.state.elements).toStrictEqual([10]);
			instance.push(20);
			instance.push(30);
			instance.push(40);
			instance.pop();
			expect(instance.state.front).toBe(1);
			expect(instance.state.size).toBe(3);
			expect(instance.state.rear).toBe(0);
			expect(instance.state.elements).toStrictEqual([10, 20, 30, 40]);
			expect(instance.push(50)).toBe(true);
			expect(instance.state.front).toBe(1);
			expect(instance.state.size).toBe(4);
			expect(instance.state.rear).toBe(1);
			expect(instance.state.elements).toStrictEqual([50, 20, 30, 40]);
		});

		it('should push 15 items into cq while maintaining a size of 1 if overwrite is false', () => {
			expect(instance.state.size).toBe(0);
			expect(instance.state.elements).toStrictEqual([]);

			const limit = 15;
			for (let i = 0; i < limit; i++) {
				instance.pop();
				expect(instance.state.front).toBe(i % instance.state.maxSize);
				expect(instance.push(i * 10)).toBe(true);
				expect(instance.state.size).toBe(1);
			}

			expect(instance.state.elements).toStrictEqual([120, 130, 140, 110]);
		});

		it('should push 15 items into cq while maintaining a size of 1 if overwrite is true', () => {
			instance.state.overwrite = true;
			expect(instance.state.size).toBe(0);
			expect(instance.state.elements).toStrictEqual([]);

			const limit = 15;
			for (let i = 0; i < limit; i++) {
				instance.pop();
				expect(instance.state.front).toBe(i % instance.state.maxSize);
				expect(instance.push(i * 10)).toBe(true);
				expect(instance.state.size).toBe(1);
			}

			expect(instance.state.elements).toStrictEqual([120, 130, 140, 110]);
			instance.state.overwrite = false;
		});

		it('should push items into cq and overwrite front when full', () => {
			instance.state.overwrite = true;
			expect(instance.state.size).toBe(0);
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

	describe('pop', () => {
		it('should run isValidState check', () => {
			const spy = jest.spyOn(instance, 'isValidState');

			spy.mockClear();
			instance.pop();
			instance.state.size = 1;
			instance.state.rear = 1;
			instance.state.elements = [10];
			instance.pop();

			expect(spy).toBeCalled();
		});

		it('should return null if isValidState returns false', () => {
			instance.state.size = -1;
			expect(instance.pop()).toBeNull();
		});

		it('should return null when cq is empty', () => {
			expect(instance.state.size).toBe(0);
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

			expect(instance.state.size).toBe(3);
			expect(instance.state.front).toBe(0);
			expect(instance.pop()).toBe(instance.state.elements[0]);
			expect(instance.state.size).toBe(2);
			expect(instance.state.front).toBe(1);
		});

		it('should return elements until cq is empty and then return null', () => {
			const custom = new ADTCircularQueue<number>({maxSize: 10});
			for (let i = 0; i < custom.state.maxSize; i++) {
				custom.push(i + 1);
			}

			for (let i = 0; i < custom.state.maxSize; i++) {
				expect(custom.pop()).toBe(i + 1);
				expect(custom.state.size).toBe(10 - i - 1);
			}
			expect(custom.state.size).toBe(0);
			expect(custom.pop()).toBeNull();
		});
	});

	describe('isInteger', () => {
		describe('should return true if n is an integer', () => {
			const types: any[] = INT_VALUES;
			types.forEach((type) => {
				it(typeof type + ': ' + type, () => {
					expect(instance.isInteger(type)).toBe(true);
				});
			});
		});

		describe('should return false if n is not an integer', () => {
			const types: any[] = ([] as any[]).concat(FLOAT_VALUES, NAN_VALUES);
			types.forEach((type) => {
				it(typeof type + ': ' + type, () => {
					expect(instance.isInteger(type!)).toBe(false);
				});
			});
		});
	});

	describe('isValidState', () => {
		it('should return true if state is a valid ADTCircularQueueState', () => {
			expect(instance.isValidState(instance.state)).toBe(true);
		});

		it('should return false if state is null or undefined', () => {
			const types = [null, undefined];
			types.forEach((type) => {
				expect(instance.isValidState(type!)).toBe(false);
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

	describe('getStateErrors', () => {
		it('should return array of errors if state is falsy', () => {
			const types = [null, undefined];
			types.forEach((type) => {
				expect(instance.getStateErrors(type!)).toContain('state is null or undefined');
			});
		});

		it('should return array of errors if state.type is not "cqState"', () => {
			const custom = new ADTCircularQueue<number>();
			const types = [null, undefined, ''];
			types.forEach((type) => {
				custom.state.type = type as any;
				expect(custom.getStateErrors(custom.state)).toContain('state type must be cqState');
			});
		});

		it('should return array of errors if state.elements is not an array', () => {
			const custom = new ADTCircularQueue<number>();
			const types = [{}, null, undefined];
			types.forEach((type) => {
				custom.state.elements = type as any;
				expect(custom.getStateErrors(custom.state)).toContain('state elements must be an array');
			});
		});

		it('should return array of errors if state.overwrite is not a boolean', () => {
			const custom = new ADTCircularQueue<number>();
			const types = [{}, '', 0, null, undefined];
			types.forEach((type) => {
				custom.state.overwrite = type as any;
				expect(custom.getStateErrors(custom.state)).toContain('state overwrite must be a boolean');
			});
		});

		describe('should return array of errors if state.size is not an integer >= 0', () => {
			const custom = new ADTCircularQueue<number>();
			const types: any[] = ([] as any[]).concat(NAN_VALUES, FLOAT_VALUES, NEG_INT_VALUES);
			types.forEach((type) => {
				it(typeof type + ': ' + type, () => {
					custom.state.size = type!;
					expect(custom.getStateErrors(custom.state)).toContain('state size must be an integer >= 0');
				});
			});
		});

		describe('should return array of errors if state.maxSize is not an integer >= 1', () => {
			const custom = new ADTCircularQueue<number>();
			const types: any[] = ([0] as any[]).concat(NAN_VALUES, FLOAT_VALUES, NEG_INT_VALUES);
			types.forEach((type) => {
				it(typeof type + ': ' + type, () => {
					custom.state.maxSize = type!;
					expect(custom.getStateErrors(custom.state)).toContain('state maxSize must be an integer >= 1');
				});
			});
		});

		describe('should return array of errors if state.front is not an integer', () => {
			const custom = new ADTCircularQueue<number>();
			const types = ([] as any[]).concat(NAN_VALUES, FLOAT_VALUES);
			types.forEach((type) => {
				it(typeof type + ': ' + type, () => {
					custom.state.front = type!;
					expect(custom.getStateErrors(custom.state)).toContain('state front must be an integer');
				});
			});
		});

		describe('should return array of errors if state.rear is not an integer', () => {
			const custom = new ADTCircularQueue<number>();
			const types = ([] as any[]).concat(NAN_VALUES, FLOAT_VALUES);
			types.forEach((type) => {
				it(typeof type + ': ' + type, () => {
					custom.state.rear = type!;
					expect(custom.getStateErrors(custom.state)).toContain('state rear must be an integer');
				});
			});
		});

		it('should return an empty array if state is valid', () => {
			expect(instance.getStateErrors(DEFAULT_STATE)).toStrictEqual([]);
		});
	});

	describe('parse', () => {
		it('should return null if argument is not a string with length > 0', () => {
			expect(instance.parse(4 as any)).toBeNull();
			expect(instance.parse([] as any)).toBeNull();
			expect(instance.parse({} as any)).toBeNull();
			expect(instance.parse('' as any)).toBeNull();
			expect(instance.parse(false as any)).toBeNull();
		});

		it('should return array of errors if string cant be parsed', () => {
			expect(instance.parse('[4,3,')).toContain('Unexpected end of JSON input');
			expect(instance.parse('{left:f,right:')).toContain('Unexpected token l in JSON at position 1');
		});

		it('should return array of errors when a parsable string does not parse into an ADTCircularQueueState', () => {
			let errors: Array<string> = [];
			let toParse: any;

			errors = instance.getStateErrors({} as any);
			errors.unshift('state is not a valid ADTCircularQueueState');
			expect(instance.parse('"null"')).toStrictEqual(errors);

			errors = instance.getStateErrors({} as any);
			errors.unshift('state is not a valid ADTCircularQueueState');
			expect(instance.parse('"undefined"')).toStrictEqual(errors);

			toParse = '{}';
			errors = instance.getStateErrors(JSON.parse(toParse) as any);
			errors.unshift('state is not a valid ADTCircularQueueState');
			expect(instance.parse(toParse)).toStrictEqual(errors);

			toParse = '{"elements":[], "type": "cqState"}';
			errors = instance.getStateErrors(JSON.parse(toParse) as any);
			errors.unshift('state is not a valid ADTCircularQueueState');
			expect(instance.parse(toParse)).toStrictEqual(errors);

			toParse = VALID_SERIALIZED_STATE.replace('9', '-5');
			errors = instance.getStateErrors(JSON.parse(toParse) as any);
			errors.unshift('state is not a valid ADTCircularQueueState');
			expect(instance.parse(toParse)).toStrictEqual(errors);
		});

		it('should return an ADTCircularQueueState when a parsable string is passed', () => {
			const string = instance.stringify();
			const expected = {...instance.state};
			expect(string).not.toBeNull();
			expect(instance.parse(string!)).toStrictEqual(expected);
			expect(instance.parse(VALID_SERIALIZED_STATE)).toStrictEqual(JSON.parse(VALID_SERIALIZED_STATE));
		});
	});

	describe('stringify', () => {
		isValidStateRuns((obj) => {
			obj.stringify();
		});

		describe('should return null if state is invalid', () => {
			const custom = new ADTCircularQueue<number>();
			STATE_PROPERTIES.forEach((type) => {
				it(typeof type + ': ' + type, () => {
					custom.reset();
					custom.state[type] = null as any;
					expect(custom.stringify()).toBeNull();
				});
			});
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

	describe('clearElements', () => {
		it('should not throw if circular queue is empty', () => {
			expect(instance.state.size).toBe(0);
			expect(() => {
				instance.clearElements();
			}).not.toThrow();
		});

		it('should remove all elements from cq and reset size, front, and rear to 0', () => {
			instance.push(1);
			instance.push(2);
			instance.pop();

			expect(instance.state.elements).not.toStrictEqual([]);
			expect(instance.state.size).not.toBe(0);
			expect(instance.state.front).not.toBe(0);
			expect(instance.state.rear).not.toBe(0);

			instance.clearElements();

			expect(instance.state.elements).toStrictEqual([]);
			expect(instance.state.size).toBe(0);
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

	describe('reset', () => {
		it('should not throw when state has errors', () => {
			instance.state.size = 0.5;
			instance.state.front = 99;
			instance.state.rear = undefined!;
			instance.state.elements = [];
			expect(() => {
				instance.reset();
			}).not.toThrow();
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
});
