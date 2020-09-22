import ADTObjectPool from '../src/object-pool';
import ADTObjectPoolState from '../src/object-pool-state';

describe('ADTObjectPool', () => {
	let instance: ADTObjectPool<objectClass>;

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

	let DEFAULT_STATE: ADTObjectPoolState<objectClass>;
	let STATE_PROPERTIES = [
		'type',
		'elements',
		'startSize',
		'objectCount',
		'maxSize',
		'autoIncrease',
		'increaseBreakPoint',
		'increaseFactor'
	];
	const VALID_SERIALIZED_STATE = [
		'{',
		'"type": "opState",',
		'"elements": [],',
		'"autoIncrease": true,',
		'"startSize": 1,',
		'"objectCount": 1,',
		'"maxSize": 4,',
		'"increaseBreakPoint": 0,',
		'"increaseFactor": 1',
		'}'
	].join('');

	class objectClass {
		public name!: string;
		public amount!: number;

		constructor() {
			objectClass.cleanObj(this);
		}

		static cleanObj(obj: objectClass): void {
			obj.name = '';
			obj.amount = 0;
		}
	}

	const isValidStateRuns = function (action: Function) {
		it('should run isValidState check', () => {
			const custom: ADTObjectPool<objectClass> = new ADTObjectPool<objectClass>(objectClass);
			const spy = jest.spyOn(custom, 'isValidState');
			spy.mockClear();
			custom.state.type = '' as any;
			action(custom);
			expect(spy).toBeCalled();
		});
	};

	beforeAll(() => {
		instance = new ADTObjectPool(objectClass);
		DEFAULT_STATE = instance.getDefaultState();
		DEFAULT_STATE.objectCount = DEFAULT_STATE.startSize;
	});

	beforeEach(() => {
		instance.reset();
	});

	describe('constructor', () => {
		it('should throw if no class is passed', () => {
			expect(() => {
				const custom = new ADTObjectPool(null as any);
			}).toThrow('Must have a class contructor for object pool to operate properly');
		});

		it('should initialize with default state when no options are paseed', () => {
			const custom = new ADTObjectPool<objectClass>(objectClass);
			expect(JSON.parse(custom.stringify()!)).toStrictEqual(DEFAULT_STATE);
		});

		it('should initialize with serializedState', () => {
			const custom = new ADTObjectPool<objectClass>(objectClass, {serializedState: VALID_SERIALIZED_STATE});
			expect(custom.state.objectCount).toBe(1);
			expect(JSON.parse(custom.stringify()!)).toStrictEqual(JSON.parse(VALID_SERIALIZED_STATE));
		});

		it('should initialize with state settings overriding serializedState', () => {
			const expected1 = {...DEFAULT_STATE};
			expected1.maxSize = 2000;

			const custom1 = new ADTObjectPool<objectClass>(objectClass, {
				maxSize: expected1.maxSize
			});

			expect(JSON.parse(custom1.stringify()!)).toStrictEqual(expected1);

			const expected2 = JSON.parse(VALID_SERIALIZED_STATE);
			expected2.maxSize = 2000;

			const custom2 = new ADTObjectPool<objectClass>(objectClass, {
				maxSize: expected2.maxSize,
				serializedState: VALID_SERIALIZED_STATE
			});

			expect(JSON.parse(custom2.stringify()!)).toStrictEqual(expected2);
		});

		it('should initialize with other options overriding serializedState if they are valid', () => {
			const expected: ADTObjectPoolState<objectClass> = JSON.parse(VALID_SERIALIZED_STATE);
			expected.startSize = 20;
			expected.objectCount = expected.startSize;
			expected.maxSize = 40;
			expected.increaseBreakPoint = 0.5;
			expected.increaseFactor = 10;

			const custom = new ADTObjectPool<objectClass>(objectClass, {
				serializedState: VALID_SERIALIZED_STATE,
				startSize: expected.startSize,
				maxSize: expected.maxSize,
				increaseBreakPoint: expected.increaseBreakPoint,
				increaseFactor: expected.increaseFactor
			});

			expect(JSON.parse(custom.stringify()!)).toStrictEqual(expected);
		});
	});

	describe('parseOptions', () => {
		it('should return default properties if options is falsey', () => {
			const defaults = {...DEFAULT_STATE};

			defaults.objectCount = 0;

			expect(instance.parseOptions()).toStrictEqual(defaults);
			expect(instance.parseOptions(null!)).toStrictEqual(defaults);
			expect(instance.parseOptions(undefined!)).toStrictEqual(defaults);
			expect(instance.parseOptions({} as any)).toStrictEqual(defaults);
		});

		it('should return properties from parsed options', () => {
			const expected1 = JSON.parse(VALID_SERIALIZED_STATE);
			expected1.objectCount = 0;

			expect(
				instance.parseOptions({
					serializedState: VALID_SERIALIZED_STATE
				})
			).toStrictEqual(expected1);

			const expected2 = JSON.parse(VALID_SERIALIZED_STATE);
			expected2.objectCount = 0;
			expected2.startSize = 95;
			expected2.maxSize = 999;
			expected2.increaseBreakPoint = 0.5;

			expect(
				instance.parseOptions({
					serializedState: VALID_SERIALIZED_STATE,
					startSize: expected2.startSize,
					maxSize: expected2.maxSize,
					increaseBreakPoint: expected2.increaseBreakPoint
				})
			).toStrictEqual(expected2);
		});
	});

	describe('parseOptionsState', () => {
		it('should return the default state if options is falsey', () => {
			const expected = {...instance.state};
			expected.elements = [];
			expected.objectCount = 0;

			expect(instance.parseOptionsState(null!)).toStrictEqual(expected);
			expect(instance.parseOptionsState('' as any)).toStrictEqual(expected);
			expect(instance.parseOptionsState(undefined!)).toStrictEqual(expected);
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

		it('should return serializedState as ADTObjectPoolState if it is valid', () => {
			const expected = JSON.parse(VALID_SERIALIZED_STATE);
			expected.objectCount = 0;

			expect(
				instance.parseOptionsState({
					serializedState: VALID_SERIALIZED_STATE
				})
			).toStrictEqual(expected);
		});
	});

	describe('parseOptionsOther', () => {
		it('should return the default state if state is falsey', () => {
			const expected = {...DEFAULT_STATE};
			expected.elements = [];
			expected.objectCount = 0;

			expect(instance.parseOptionsOther(null!)).toStrictEqual(expected);
			expect(instance.parseOptionsOther('' as any)).toStrictEqual(expected);
			expect(instance.parseOptionsOther(undefined!)).toStrictEqual(expected);
		});

		it('should return passed state if options is null or undefined', () => {
			const types = [null, undefined];
			types.forEach((type) => {
				expect(instance.parseOptionsOther(instance.state, type!)).toStrictEqual(instance.state);
				expect(instance.parseOptionsOther(DEFAULT_STATE as any, type!)).toStrictEqual(DEFAULT_STATE);
				expect(instance.parseOptionsOther(instance.parse(VALID_SERIALIZED_STATE) as any, type!)).toStrictEqual(
					instance.parse(VALID_SERIALIZED_STATE)
				);
			});
		});

		it('should return passed state with values changed to match other passed options', () => {
			const expected: ADTObjectPoolState<objectClass> = {...DEFAULT_STATE};
			expected.startSize = 20;
			expected.maxSize = 40;
			expected.increaseBreakPoint = 0.5;
			expected.increaseFactor = 10;

			const result = instance.parseOptionsOther(DEFAULT_STATE, {
				startSize: expected.startSize,
				maxSize: expected.maxSize,
				increaseBreakPoint: expected.increaseBreakPoint,
				increaseFactor: expected.increaseFactor
			});

			expect(result).toStrictEqual(expected);
		});

		it('should return passed state with values changed to match other passed options if those are valid', () => {
			const expected: ADTObjectPoolState<objectClass> = {...DEFAULT_STATE};
			expected.startSize = 20;
			expected.increaseFactor = 10;

			const result = instance.parseOptionsOther(DEFAULT_STATE, {
				startSize: expected.startSize,
				maxSize: 155.55,
				increaseBreakPoint: -1,
				increaseFactor: expected.increaseFactor
			});

			expect(result).toStrictEqual(expected);
		});
	});

	describe('utilization', () => {
		isValidStateRuns((obj) => {
			obj.utilization(0);
		});

		describe('should return % of objects used as a decimal', () => {
			const types: any[] = ([0] as any[]).concat(NUM_VALUES, NAN_VALUES);
			types.forEach((type) => {
				it(typeof type + ': ' + type, () => {
					expect(instance.utilization(type!)).not.toBeNaN();
				});
			});

			it('this.state.objectCount === 0', () => {
				instance.state.objectCount = 0;
				expect(instance.utilization()).toBe(Infinity);
			});
		});
	});

	describe('isAboveThreshold', () => {
		isValidStateRuns((obj) => {
			obj.isAboveThreshold();
		});

		describe('should always return a boolean', () => {
			const typesTrue: any[] = ([0] as any[]).concat(POS_NUM_VALUES, NAN_VALUES);
			typesTrue.forEach((type) => {
				it(typeof type + ': ' + type + ' = true', () => {
					instance.state.increaseBreakPoint = 0;
					expect(instance.isAboveThreshold(type!)).toBe(true);
				});
			});

			const typesFalse: any[] = ([] as any[]).concat(NEG_NUM_VALUES);
			typesFalse.forEach((type) => {
				it(typeof type + ': ' + type + ' = false', () => {
					instance.state.increaseBreakPoint = 0;
					expect(instance.isAboveThreshold(type!)).toBe(false);
				});
			});
		});
	});

	describe('allocate', () => {
		isValidStateRuns((obj) => {
			obj.allocate();
		});

		it("should return null if pool has no more objects and can't increase", () => {
			instance.clearElements();
			expect(instance.state.autoIncrease).toBe(false);
			instance.state.objectCount = 10;
			expect(instance.state.objectCount).toBe(10);
			expect(instance.state.elements.length).toBe(0);
			expect(instance.allocate()).toBeNull();
		});

		it('should return 1 element from pool if only 1 is available', () => {
			instance.clearElements();
			expect(instance.state.autoIncrease).toBe(false);
			instance.increaseCapacity(1);
			expect(instance.state.objectCount).toBe(1);
			expect(instance.state.elements.length).toBe(1);
			expect(instance.allocate()).not.toBeNull();
			expect(instance.state.elements.length).toBe(0);
		});

		it('should return 1 element from pool if multiple are available', () => {
			expect(instance.state.autoIncrease).toBe(false);
			expect(instance.state.objectCount).toBe(10);
			expect(instance.state.elements.length).toBe(10);
			expect(instance.allocate()).not.toBeNull();
			expect(instance.state.elements.length).toBe(9);
		});
	});

	describe('allocateMultiple', () => {
		isValidStateRuns((obj) => {
			obj.allocateMultiple();
		});

		describe('should return n elements from the pool if n is an int > 0', () => {
			const types: any[] = ([50] as any[]).concat(POS_INT_VALUES);
			types.forEach((type) => {
				it(typeof type + ': ' + type, () => {
					let objs: any[] = [];
					expect(objs.length).toBe(0);

					objs = instance.allocateMultiple(type);
					expect(objs.length).toBe(Math.min(type, instance.state.objectCount));
					objs.forEach((obj) => {
						instance.release(obj);
					});

					instance.state.autoIncrease = true;
					objs = instance.allocateMultiple(type);
					expect(objs.length).toBe(type);
				});
			});
		});

		describe('should grab 1 element from the pool if n is anything else', () => {
			const types: any[] = ([0] as any[]).concat(FLOAT_VALUES, NAN_VALUES, NEG_INT_VALUES);
			types.forEach((type) => {
				it(typeof type + ': ' + type, () => {
					let objs: any[] = [];
					expect(objs.length).toBe(0);

					objs = instance.allocateMultiple(type!);
					expect(objs.length).toBe(1);
					objs.forEach((obj) => {
						instance.release(obj);
					});

					instance.state.autoIncrease = true;
					objs = instance.allocateMultiple(type!);
					expect(objs.length).toBe(1);
				});
			});
		});
	});

	describe('increaseCapacity', () => {
		isValidStateRuns((obj) => {
			obj.increaseCapacity();
		});

		describe('should do nothing if n is not an integer 1 or greater', () => {
			const types: any[] = ([0] as any[]).concat(FLOAT_VALUES, NAN_VALUES, NEG_NUM_VALUES);
			types.forEach((type) => {
				it(typeof type + ': ' + type, () => {
					expect(instance.state.objectCount).toBe(10);
					instance.increaseCapacity(type!);
					expect(instance.state.objectCount).toBe(10);
				});
			});
		});

		it('should increase the objectCount by n up to maxSize and create that many new elements', () => {
			expect(instance.state.objectCount).toBe(10);
			expect(instance.state.elements.length).toBe(10);

			instance.increaseCapacity(1);
			expect(instance.state.objectCount).toBe(11);
			expect(instance.state.elements.length).toBe(11);

			instance.increaseCapacity(10);
			expect(instance.state.objectCount).toBe(21);
			expect(instance.state.elements.length).toBe(21);
		});
	});

	describe('release', () => {
		it('should call cleanObj and store if cleanObj is defined', () => {
			const spy1 = jest.spyOn(instance, 'store');
			const spy2 = jest.spyOn(instance.objectClass, 'cleanObj');

			spy1.mockClear();
			spy2.mockClear();

			instance.release({} as any);

			expect(spy1).toBeCalled();
			expect(spy2).toBeCalled();
		});

		it('should not call store if cleanObj is not defined', () => {
			const custom = new ADTObjectPool<objectClass>(objectClass, {startSize: 0});
			const spy = jest.spyOn(custom, 'store');

			spy.mockClear();

			const cleanObj = custom.objectClass.cleanObj;
			custom.objectClass.cleanObj = undefined as any;
			custom.release({} as any);

			expect(spy).not.toBeCalled();
			custom.objectClass.cleanObj = cleanObj;
		});
	});

	describe('releaseMultiple', () => {
		it('should not throw if array is empty',()=>{
			expect(instance.state.elements.length).toBe(10);

			expect(()=>{
				instance.releaseMultiple([]);
			}).not.toThrow();

			expect(instance.state.elements.length).toBe(10);
		})

		it('should release element from array if there is only 1', () => {
			expect(instance.state.elements.length).toBe(instance.state.objectCount);

			const objs = instance.allocateMultiple(1);
			expect(instance.state.elements.length).toBe(instance.state.objectCount - 1);
			
			instance.releaseMultiple(objs);
			expect(instance.state.elements.length).toBe(instance.state.objectCount);
		});

		it('should release all elements from the array', () => {
			expect(instance.state.elements.length).toBe(instance.state.objectCount);

			const amount = 5;
			const objs = instance.allocateMultiple(amount);
			expect(instance.state.elements.length).toBe(instance.state.objectCount - amount);
			
			instance.releaseMultiple(objs);
			expect(instance.state.elements.length).toBe(instance.state.objectCount);
		});
	});

	describe('store', () => {
		isValidStateRuns((obj) => {
			obj.store();
		});

		it('should add obj to elements', () => {
			expect(instance.state.elements.length).toBe(10);
			instance.store({} as any);
			expect(instance.state.elements.length).toBe(11);
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

	describe('isFloat', () => {
		describe('should return true if n is a float', () => {
			const types: any[] = ([] as any[]).concat(NUM_VALUES);
			types.forEach((type) => {
				it(typeof type + ': ' + type, () => {
					expect(instance.isFloat(type)).toBe(true);
				});
			});
		});

		describe('should return false if n is not a float', () => {
			const types: any[] = ([] as any[]).concat(NAN_VALUES);
			types.forEach((type) => {
				it(typeof type + ': ' + type, () => {
					expect(instance.isFloat(type!)).toBe(false);
				});
			});
		});
	});

	describe('isValidState', () => {
		it('should return true if state is a valid ADTObjectPoolState', () => {
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

		it('should return array of errors if state.type is not "opState"', () => {
			const custom = new ADTObjectPool<objectClass>(objectClass);
			const types = [null, undefined, ''];
			types.forEach((type) => {
				custom.state.type = type as any;
				expect(custom.getStateErrors(custom.state)).toContain('state type must be opState');
			});
		});

		it('should return array of errors if state.elements is not an array', () => {
			const custom = new ADTObjectPool<objectClass>(objectClass);
			const types = [{}, null, undefined];
			types.forEach((type) => {
				custom.state.elements = type as any;
				expect(custom.getStateErrors(custom.state)).toContain('state elements must be an array');
			});
		});

		it('should return array of errors if state.autoIncrease is not a boolean', () => {
			const custom = new ADTObjectPool<objectClass>(objectClass);
			const types = [{}, '', 0, null, undefined];
			types.forEach((type) => {
				custom.state.autoIncrease = type as any;
				expect(custom.getStateErrors(custom.state)).toContain('state autoIncrease must be a boolean');
			});
		});

		describe('should return array of errors if state.startSize is not an integer >= 0', () => {
			const custom = new ADTObjectPool<objectClass>(objectClass);
			const types: any[] = ([] as any[]).concat(NAN_VALUES, FLOAT_VALUES, NEG_INT_VALUES);
			types.forEach((type) => {
				it(typeof type + ': ' + type, () => {
					custom.state.startSize = type!;
					expect(custom.getStateErrors(custom.state)).toContain('state startSize must be an integer >= 0');
				});
			});
		});

		describe('should return array of errors if state.objectCount is not an integer >= 0', () => {
			const custom = new ADTObjectPool<objectClass>(objectClass);
			const types: any[] = ([] as any[]).concat(NAN_VALUES, FLOAT_VALUES, NEG_INT_VALUES);
			types.forEach((type) => {
				it(typeof type + ': ' + type, () => {
					custom.state.objectCount = type!;
					expect(custom.getStateErrors(custom.state)).toContain('state objectCount must be an integer >= 0');
				});
			});
		});

		describe('should return array of errors if state.maxSize is not an integer >= 1', () => {
			const custom = new ADTObjectPool<objectClass>(objectClass);
			const types: any[] = ([0] as any[]).concat(NAN_VALUES, FLOAT_VALUES, NEG_INT_VALUES);
			types.forEach((type) => {
				it(typeof type + ': ' + type, () => {
					custom.state.maxSize = type!;
					expect(custom.getStateErrors(custom.state)).toContain('state maxSize must be an integer >= 1');
				});
			});
		});

		describe('should return array of errors if state.increaseBreakPoint is not (0 <= number <= 1)', () => {
			const custom = new ADTObjectPool<objectClass>(objectClass);
			const types = ([2, 2.5] as any[]).concat(NAN_VALUES, NEG_NUM_VALUES);
			types.forEach((type) => {
				it(typeof type + ': ' + type, () => {
					custom.state.increaseBreakPoint = type!;
					expect(custom.getStateErrors(custom.state)).toContain('state increaseBreakPoint must be a number between 0 and 1');
				});
			});
		});

		describe('should return array of errors if state.increaseFactor is not a number > 0', () => {
			const custom = new ADTObjectPool<objectClass>(objectClass);
			const types = ([] as any[]).concat(NAN_VALUES, NEG_NUM_VALUES);
			types.forEach((type) => {
				it(typeof type + ': ' + type, () => {
					custom.state.increaseFactor = type!;
					expect(custom.getStateErrors(custom.state)).toContain('state increaseFactor must be a positive number');
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

		it('should return array of errors when a parsable string does not parse into an ADTObjectPoolState', () => {
			let errors: Array<string> = [];
			let toParse: any;

			errors = instance.getStateErrors({} as any);
			errors.unshift('state is not a valid ADTObjectPoolState');
			expect(instance.parse('"null"')).toStrictEqual(errors);

			errors = instance.getStateErrors({} as any);
			errors.unshift('state is not a valid ADTObjectPoolState');
			expect(instance.parse('"undefined"')).toStrictEqual(errors);

			toParse = '{}';
			errors = instance.getStateErrors(JSON.parse(toParse) as any);
			errors.unshift('state is not a valid ADTObjectPoolState');
			expect(instance.parse(toParse)).toStrictEqual(errors);

			toParse = '{"elements":[], "type": "opState"}';
			errors = instance.getStateErrors(JSON.parse(toParse) as any);
			errors.unshift('state is not a valid ADTObjectPoolState');
			expect(instance.parse(toParse)).toStrictEqual(errors);

			toParse = VALID_SERIALIZED_STATE.replace('0', '-5');
			errors = instance.getStateErrors(JSON.parse(toParse) as any);
			errors.unshift('state is not a valid ADTObjectPoolState');
			expect(instance.parse(toParse)).toStrictEqual(errors);
		});

		it('should return an ADTObjectPoolState when a parsable string is passed', () => {
			const string = instance.stringify();
			const expected = {...instance.state};
			expected.elements = [];
			expect(string!).not.toBeNull();
			expect(instance.parse(string as any)).toStrictEqual(expected);
			expect(instance.parse(VALID_SERIALIZED_STATE)).toStrictEqual(JSON.parse(VALID_SERIALIZED_STATE));
		});
	});

	describe('stringify', () => {
		isValidStateRuns((obj) => {
			obj.stringify();
		});

		describe('should return null if state is invalid', () => {
			const custom = new ADTObjectPool<objectClass>(objectClass);
			STATE_PROPERTIES.forEach((type) => {
				it(typeof type + ': ' + type, () => {
					custom.reset();
					custom.state[type] = null as any;
					expect(custom.stringify()).toBeNull();
				});
			});
		});

		it('should return the state as a string if it is validated', () => {
			const custom = new ADTObjectPool<objectClass>(objectClass);
			expect(JSON.parse(custom.stringify()!)).toStrictEqual({
				type: 'opState',
				elements: [],
				startSize: 10,
				objectCount: 10,
				maxSize: 1000,
				autoIncrease: false,
				increaseFactor: 2,
				increaseBreakPoint: 0.8
			});

			custom.increaseCapacity(1);
			expect(JSON.parse(custom.stringify()!)).toStrictEqual({
				type: 'opState',
				elements: [],
				startSize: 10,
				objectCount: 11,
				maxSize: 1000,
				autoIncrease: false,
				increaseFactor: 2,
				increaseBreakPoint: 0.8
			});

			custom.increaseCapacity(2);
			expect(JSON.parse(custom.stringify()!)).toStrictEqual({
				type: 'opState',
				elements: [],
				startSize: 10,
				objectCount: 13,
				maxSize: 1000,
				autoIncrease: false,
				increaseFactor: 2,
				increaseBreakPoint: 0.8
			});

			custom.increaseCapacity(10);
			expect(JSON.parse(custom.stringify()!)).toStrictEqual({
				type: 'opState',
				elements: [],
				startSize: 10,
				objectCount: 23,
				maxSize: 1000,
				autoIncrease: false,
				increaseFactor: 2,
				increaseBreakPoint: 0.8
			});
		});
	});

	describe('clearElements', () => {
		it('should not throw if object pool is empty', () => {
			instance.state.elements = [];
			expect(() => {
				instance.clearElements();
			}).not.toThrow();
		});

		it('should remove all elements from op and reset objectCount to 0', () => {
			expect(instance.state.elements).not.toStrictEqual([]);
			expect(instance.state.objectCount).not.toBe(0);

			instance.clearElements();

			expect(instance.state.elements).toStrictEqual([]);
			expect(instance.state.objectCount).toBe(0);
		});

		it('should not change any other state variables', () => {
			const custom = new ADTObjectPool<objectClass>(objectClass);

			custom.state.type = 'test' as any;
			custom.state.autoIncrease = 'test' as any;
			custom.state.maxSize = 'test' as any;
			custom.state.increaseBreakPoint = 'test' as any;
			custom.state.increaseFactor = 'test' as any;

			custom.clearElements();

			expect(custom.state.type).toBe('test');
			expect(custom.state.autoIncrease).toBe('test');
			expect(custom.state.maxSize).toBe('test');
			expect(custom.state.increaseBreakPoint).toBe('test');
			expect(custom.state.increaseFactor).toBe('test');
		});
	});

	describe('reset', () => {
		it('should not throw if state has errors', () => {
			instance.state.elements = '' as any;
			expect(() => {
				instance.reset();
			}).not.toThrow();
		});

		it('should set objectCount to startSize and initialize that many elements', () => {
			expect(instance.state.elements).not.toStrictEqual([]);
			expect(instance.state.objectCount).not.toBe(0);
			instance.reset();
			expect(instance.state.elements.length).toBe(instance.state.startSize);
			expect(instance.state.objectCount).toBe(instance.state.startSize);
		});

		it('should change state variables to default', () => {
			const custom = new ADTObjectPool<objectClass>(objectClass);

			custom.state.type = 'test' as any;
			custom.state.autoIncrease = 'test' as any;
			custom.state.maxSize = 'test' as any;
			custom.state.increaseBreakPoint = 'test' as any;
			custom.state.increaseFactor = 'test' as any;

			custom.reset();

			expect(custom.state.type).toBe('opState');
			expect(custom.state.autoIncrease).toBe(false);
			expect(custom.state.maxSize).toBe('test');
			expect(custom.state.increaseBreakPoint).toBe(0.8);
			expect(custom.state.increaseFactor).toBe(2);
		});
	});

	describe('select', () => {});
});
