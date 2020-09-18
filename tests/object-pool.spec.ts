import ArmorObjectPool from '../src/object-pool';
import ArmorObjectPoolInstance from '../src/object-pool-instance';
import ArmorObjectPoolState from '../src/object-pool-state';

describe('ArmorObjectPool', () => {
	let instance: ArmorObjectPool<objectClass>;

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

	const DEFAULT_STATE = {
		type: 'opState',
		elements: [],
		maxSize: 1000,
		objectCount: 10,
		autoIncrease: false,
		increaseBreakPoint: 0.8,
		increaseFactor: 2
	};
	const VALID_SERIALIZED_STATE = [
		'{',
		'"type": "opState",',
		'"elements": [],',
		'"objectCount": 1,',
		'"maxSize": 4,',
		'"autoIncrease": true,',
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
			const custom: ArmorObjectPool<objectClass> = new ArmorObjectPool<objectClass>(objectClass);
			const spy = jest.spyOn(custom, 'isValidState');
			spy.mockClear();
			custom.state.type = '' as any;
			action(custom);
			expect(spy).toBeCalled();
		});
	};

	beforeAll(() => {
		instance = new ArmorObjectPool(objectClass);
	});
	beforeEach(() => {
		instance.reset();
	});

	describe('constructor', () => {
		it('should throw if no class is passed', () => {
			expect(() => {
				const custom = new ArmorObjectPool(null as any);
			}).toThrow();
		});

		it('should initialize with default state when no options are paseed', () => {
			const custom = new ArmorObjectPool<objectClass>(objectClass);
			expect(JSON.parse(custom.stringify()!)).toStrictEqual(DEFAULT_STATE);
			expect(custom.startSize).toBe(10);
		});

		it('should initialize with serializedState', () => {
			const custom = new ArmorObjectPool<objectClass>(objectClass, {serializedState: VALID_SERIALIZED_STATE});
			expect(custom.state.objectCount).toBe(1);
			expect(JSON.parse(custom.stringify()!)).toStrictEqual(JSON.parse(VALID_SERIALIZED_STATE));
			expect(custom.startSize).toBe(1);
		});

		it('should initialize with state settings overriding serializedState', () => {
			const expected1 = {...DEFAULT_STATE};
			expected1.maxSize = 2000;

			const custom1 = new ArmorObjectPool<objectClass>(objectClass, {
				state: {maxSize: expected1.maxSize} as ArmorObjectPoolState<objectClass>
			});

			expect(JSON.parse(custom1.stringify()!)).toStrictEqual(expected1);

			const expected2 = JSON.parse(VALID_SERIALIZED_STATE);
			expected2.maxSize = 2000;

			const custom2 = new ArmorObjectPool<objectClass>(objectClass, {
				state: {maxSize: expected2.maxSize} as ArmorObjectPoolState<objectClass>,
				serializedState: VALID_SERIALIZED_STATE
			});

			expect(JSON.parse(custom2.stringify()!)).toStrictEqual(expected2);
		});

		it('should initialize with startSize overriding serializedState', () => {
			const expected = JSON.parse(VALID_SERIALIZED_STATE);
			expected.objectCount = 3;

			const custom = new ArmorObjectPool<objectClass>(objectClass, {
				serializedState: VALID_SERIALIZED_STATE,
				startSize: expected.objectCount
			});
			expect(custom.startSize).toBe(expected.objectCount);
			expect(JSON.parse(custom.stringify()!)).toStrictEqual(expected);
		});
	});
	describe('parseOptions', () => {
		it('should return default properties if options is falsey', () => {
			const defaults = {
				startSize: 10,
				state: {...DEFAULT_STATE}
			};

			defaults.state.objectCount = 0;

			expect(instance.parseOptions()).toStrictEqual(defaults);
			expect(instance.parseOptions(null!)).toStrictEqual(defaults);
			expect(instance.parseOptions(undefined!)).toStrictEqual(defaults);
			expect(instance.parseOptions({} as any)).toStrictEqual(defaults);
		});

		it('should return properties from parsed options', () => {
			expect(
				instance.parseOptions({
					serializedState: VALID_SERIALIZED_STATE
				})
			).toStrictEqual({
				startSize: 1,
				state: JSON.parse(VALID_SERIALIZED_STATE.replace(/objectCount": 1/, 'objectCount":0'))
			});

			expect(
				instance.parseOptions({
					startSize: 2,
					serializedState: VALID_SERIALIZED_STATE
				})
			).toStrictEqual({
				startSize: 2,
				state: JSON.parse(VALID_SERIALIZED_STATE.replace(/objectCount": 1/, 'objectCount":0'))
			});
		});
	});
	describe('parseOptionsState', () => {
		it('should return the default state if options is falsey', () => {
			const state = instance.state;
			state.elements = [];
			expect(instance.parseOptionsState(null!)).toEqual(state);
			expect(instance.parseOptionsState('' as any)).toEqual(state);
			expect(instance.parseOptionsState(undefined!)).toEqual(state);
		});

		it('should throw if serializedState is not valid', () => {
			expect(() => {
				instance.parseOptionsState({
					serializedState: instance.stringify()!.replace(/opState/, 'null')
				});
			}).toThrow();

			expect(() => {
				instance.parseOptionsState({
					serializedState: instance.stringify()!.replace(/autoIncrease":false/, 'autoIncrease":null')
				});
			}).toThrow();

			expect(() => {
				instance.parseOptionsState({
					serializedState: instance.stringify()!.replace(/elements":\[.*?\]/, 'elements":null')
				});
			}).toThrow();

			expect(() => {
				instance.parseOptionsState({
					serializedState: instance.stringify()!.replace(/maxSize":1000/, 'maxSize":null')
				});
			}).toThrow();

			expect(() => {
				instance.parseOptionsState({
					serializedState: instance.stringify()!.replace(/objectCount":10/, 'objectCount":null')
				});
			}).toThrow();

			expect(() => {
				instance.parseOptionsState({
					serializedState: instance
						.stringify()!
						.replace(/increaseBreakPoint":0\.8/, 'increaseBreakPoint":null')
				});
			}).toThrow();

			expect(() => {
				instance.parseOptionsState({
					serializedState: instance.stringify()!.replace(/increaseFactor":2/, 'increaseFactor":null')
				});
			}).toThrow();
		});

		it('should return serializedState as ArmorObjectPoolState if it is valid', () => {
			expect(
				instance.parseOptionsState({
					serializedState: VALID_SERIALIZED_STATE
				})
			).toEqual(JSON.parse(VALID_SERIALIZED_STATE));
		});
	});
	describe('parseOptionsStartSize', () => {
		it('should return 10 state is not valid', () => {
			expect(instance.parseOptionsStartSize({} as any)).toBe(10);
		});

		it('should return value of state.objectCount if options is null or undefined', () => {
			const types = [null, undefined];
			types.forEach((type) => {
				expect(instance.parseOptionsStartSize(instance.state, {startSize: type!})).toBe(
					instance.state.objectCount
				);
			});
		});

		describe('should return value of state.objectCount if options.startSize is not a positive integer', () => {
			const types: any[] = ([0] as any[]).concat(NEG_NUM_VALUES, POS_FLOAT_VALUES, NAN_VALUES);
			types.forEach((type) => {
				it(typeof type + ': ' + type, () => {
					expect(instance.parseOptionsStartSize(instance.state, {startSize: type})).toBe(
						instance.state.objectCount
					);
				});
			});
		});

		describe('should return options.startSize if it is a positive integer', () => {
			const types: any[] = ([] as any[]).concat(POS_INT_VALUES);
			types.forEach((type) => {
				it(typeof type + ': ' + type, () => {
					const startSize = instance.startSize;
					instance.parseOptionsStartSize(type);
					expect(instance.parseOptionsStartSize(instance.state, {startSize: type})).toBe(type);
				});
			});
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
			const custom = new ArmorObjectPool<objectClass>(objectClass, {startSize: 0});
			const spy = jest.spyOn(custom, 'store');

			spy.mockClear();

			const cleanObj = custom.objectClass.cleanObj;
			custom.objectClass.cleanObj = undefined as any;
			custom.release({} as any);

			expect(spy).not.toBeCalled();
			custom.objectClass.cleanObj = cleanObj;
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
		it('should return true if state is a valid ArmorObjectPoolState', () => {
			expect(instance.isValidState(instance.state)).toBe(true);
		});

		it('should return false if state is null or undefined', () => {
			const types = [null, undefined];
			types.forEach((type) => {
				expect(instance.isValidState(type!)).toBe(false);
			});
		});

		it('should return false if state.type is not "opState"', () => {
			const custom = new ArmorObjectPool<objectClass>(objectClass);
			const types = [null, undefined, ''];
			types.forEach((type) => {
				custom.state.type = type as 'opState';
				expect(custom.isValidState(custom.state)).toBe(false);
			});
		});

		it('should return false if state.elements is not an array', () => {
			const custom = new ArmorObjectPool<objectClass>(objectClass);
			const types = [{}, null, undefined];
			types.forEach((type) => {
				custom.state.elements = type as Array<objectClass>;
				expect(custom.isValidState(custom.state)).toBe(false);
			});
		});

		describe('should return false if state.maxSize is not an integer >= 1', () => {
			const custom = new ArmorObjectPool<objectClass>(objectClass);
			const types: any[] = ([0] as any[]).concat(NAN_VALUES, FLOAT_VALUES, NEG_INT_VALUES);
			types.forEach((type) => {
				it(typeof type + ': ' + type, () => {
					custom.state.maxSize = type!;
					expect(custom.isValidState(custom.state)).toBe(false);
				});
			});
		});

		describe('should return false if state.objectCount is not an integer >= 0', () => {
			const custom = new ArmorObjectPool<objectClass>(objectClass);
			const types: any[] = ([] as any[]).concat(NAN_VALUES, FLOAT_VALUES, NEG_INT_VALUES);
			types.forEach((type) => {
				it(typeof type + ': ' + type, () => {
					custom.state.objectCount = type!;
					expect(custom.isValidState(custom.state)).toBe(false);
				});
			});
		});

		describe('should return false if state.increaseFactor is not a number > 0', () => {
			const custom = new ArmorObjectPool<objectClass>(objectClass);
			const types = ([] as any[]).concat(NAN_VALUES, NEG_NUM_VALUES);
			types.forEach((type) => {
				it(typeof type + ': ' + type, () => {
					custom.state.increaseFactor = type!;
					expect(custom.isValidState(custom.state)).toBe(false);
				});
			});
		});

		describe('should return false if state.increaseBreakPoint is not (0 <= number <= 1)', () => {
			const custom = new ArmorObjectPool<objectClass>(objectClass);
			const types = ([2, 2.5] as any[]).concat(NAN_VALUES, NEG_NUM_VALUES);
			types.forEach((type) => {
				it(typeof type + ': ' + type, () => {
					custom.state.increaseBreakPoint = type!;
					expect(custom.isValidState(custom.state)).toBe(false);
				});
			});
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

		it('should return null if string cant be parsed', () => {
			expect(instance.parse('[4,3,')).toBeNull();
			expect(instance.parse('{left:f,right:')).toBeNull();
		});

		it('should return null when a parsable string does not parse into an ArmorObjectPoolState', () => {
			expect(instance.parse('null')).toBeNull();
			expect(instance.parse('undefined')).toBeNull();
			expect(instance.parse('{"elements":[], "type": "opState"}')).toBeNull();
			expect(instance.parse('{}')).toBeNull();
			expect(instance.parse('[1,2,3]')).toBeNull();
		});

		it('should return an ArmorObjectPoolState when a parsable string is passed', () => {
			const string = instance.stringify();
			const expected = {...instance.state};
			expected.elements = [];
			expect(string).not.toBeNull();
			expect(instance.parse(string as string)).toStrictEqual(expected);
			expect(instance.parse(VALID_SERIALIZED_STATE)).toStrictEqual(JSON.parse(VALID_SERIALIZED_STATE));
		});
	});
	describe('stringify', () => {
		isValidStateRuns((obj) => {
			obj.stringify();
		});

		describe('should return null if state is invalid', () => {
			const custom = new ArmorObjectPool<objectClass>(objectClass);
			const types = [
				'type',
				'elements',
				'autoIncrease',
				'maxSize',
				'objectCount',
				'increaseBreakPoint',
				'increaseFactor'
			];
			types.forEach((type) => {
				it(typeof type + ': ' + type, () => {
					custom.reset();
					custom.state[type] = null as any;
					expect(custom.stringify()).toBeNull();
				});
			});
		});

		it('should return the state as a string if it is validated', () => {
			const custom = new ArmorObjectPool<objectClass>(objectClass);
			expect(JSON.parse(custom.stringify()!)).toEqual({
				type: 'opState',
				elements: [],
				objectCount: 10,
				maxSize: 1000,
				autoIncrease: false,
				increaseFactor: 2,
				increaseBreakPoint: 0.8
			});

			custom.increaseCapacity(1);
			expect(JSON.parse(custom.stringify()!)).toEqual({
				type: 'opState',
				elements: [],
				objectCount: 11,
				maxSize: 1000,
				autoIncrease: false,
				increaseFactor: 2,
				increaseBreakPoint: 0.8
			});

			custom.increaseCapacity(2);
			expect(JSON.parse(custom.stringify()!)).toEqual({
				type: 'opState',
				elements: [],
				objectCount: 13,
				maxSize: 1000,
				autoIncrease: false,
				increaseFactor: 2,
				increaseBreakPoint: 0.8
			});

			custom.increaseCapacity(10);
			expect(JSON.parse(custom.stringify()!)).toEqual({
				type: 'opState',
				elements: [],
				objectCount: 23,
				maxSize: 1000,
				autoIncrease: false,
				increaseFactor: 2,
				increaseBreakPoint: 0.8
			});
		});
	});

	describe('clearElements', () => {
		it('should not throw if state has errors', () => {
			instance.state.elements = '' as any;
			expect(() => {
				instance.clearElements();
			}).not.toThrow();
		});

		it('should remove all elements from op and reset objectCount to 0', () => {
			expect(instance.state.elements).not.toEqual([]);
			expect(instance.state.objectCount).not.toBe(0);

			instance.clearElements();

			expect(instance.state.elements).toEqual([]);
			expect(instance.state.objectCount).toBe(0);
		});

		it('should not change any other state variables', () => {
			const custom = new ArmorObjectPool<objectClass>(objectClass);

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
			console.log(instance.stringify());
			expect(instance.state.elements).not.toEqual([]);
			expect(instance.state.objectCount).not.toBe(0);
			instance.reset();
			expect(instance.state.elements.length).toBe(instance.startSize);
			expect(instance.state.objectCount).toBe(instance.startSize);
		});

		it('should change state variables to default', () => {
			const custom = new ArmorObjectPool<objectClass>(objectClass);

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
