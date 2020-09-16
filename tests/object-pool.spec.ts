import ArmorObjectPool from '../src/object-pool';
import ArmorObjectPoolInstance from '../src/object-pool-instance';
import ArmorObjectPoolState from '../src/object-pool-state';

describe('ArmorObjectPool', () => {
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

	class poolObjClass {
		public name!: string;
		public amount!: number;

		constructor() {
			poolObjClass.cleanObj(this);
		}

		static cleanObj(obj: poolObjClass): void {
			obj.name = '';
			obj.amount = 0;
		}
	}

	let instance: ArmorObjectPool<poolObjClass>;

	const isValidStateRuns = function (action: Function) {
		it('should run isValidState check', () => {
			const custom: ArmorObjectPool<poolObjClass> = new ArmorObjectPool<poolObjClass>(poolObjClass);
			const spy = jest.spyOn(custom, 'isValidState');
			spy.mockClear();
			custom.state.type = '' as any;
			action(custom);
			expect(spy).toBeCalled();
		});
	};

	beforeAll(() => {
		instance = new ArmorObjectPool(poolObjClass);
	});

	beforeEach(() => {
		instance.reset();
	});

	describe('constructor', () => {
		it('should throw if no class is passed', () => {
			expect(() => {
				const custom = new ArmorObjectPool({} as any);
			}).toThrow();
		});

		it('should initialize with state when passed one', () => {
			const state: ArmorObjectPoolState<poolObjClass> = {
				elements: [],
				type: 'opState',
				maxSize: 9,
				objectCount: 2,
				autoIncrease: true,
				increaseBreakPoint: 1,
				increaseFactor: 5
			};

			const custom = new ArmorObjectPool<poolObjClass>(poolObjClass, {state: state});
			expect(JSON.parse(custom.stringify()!)).toStrictEqual(state);
		});

		it('should initialize with startSize overriding state', () => {
			const state: ArmorObjectPoolState<poolObjClass> = {
				elements: [],
				type: 'opState',
				maxSize: 9,
				objectCount: 2,
				autoIncrease: true,
				increaseBreakPoint: 1,
				increaseFactor: 5
			};

			const custom = new ArmorObjectPool<poolObjClass>(poolObjClass, {state: state, startSize: 5});
			expect(custom.state.objectCount).toBe(5);
		});
	});
	describe('parseOptions', () => {
		it('should return void if options is falsey', () => {
			expect(instance.parseOptions(null!)).toBeFalsy();
			expect(instance.parseOptions(undefined!)).toBeFalsy();
		});

		it('should call parseOptionsState if options has state property', () => {
			const spy = jest.spyOn(instance, 'parseOptionsState');

			try {
				spy.mockClear();
				instance.parseOptions({state: ''});
			} catch (e) {}
			expect(spy).toBeCalled();

			try {
				spy.mockClear();
				instance.parseOptions({state: '{}'});
			} catch (e) {}
			expect(spy).toBeCalled();

			try {
				spy.mockClear();
				instance.parseOptions({state: {} as any});
			} catch (e) {}
			expect(spy).toBeCalled();

			try {
				spy.mockClear();
				instance.parseOptions({state: null!});
			} catch (e) {}
			expect(spy).toBeCalled();

			try {
				spy.mockClear();
				instance.parseOptions({state: instance.state});
			} catch (e) {}
			expect(spy).toBeCalled();

			try {
				spy.mockClear();
				instance.parseOptions({state: instance.stringify() as string});
			} catch (e) {}
			expect(spy).toBeCalled();
		});

		it('should call parseOptionsStartSize if options has startSize property', () => {
			const spy = jest.spyOn(instance, 'parseOptionsStartSize');

			try {
				spy.mockClear();
				instance.parseOptions({startSize: '' as any});
			} catch (e) {}
			expect(spy).toBeCalled();

			try {
				spy.mockClear();
				instance.parseOptions({startSize: '{}' as any});
			} catch (e) {}
			expect(spy).toBeCalled();

			try {
				spy.mockClear();
				instance.parseOptions({startSize: {} as any});
			} catch (e) {}
			expect(spy).toBeCalled();

			try {
				spy.mockClear();
				instance.parseOptions({startSize: null!});
			} catch (e) {}
			expect(spy).toBeCalled();

			try {
				spy.mockClear();
				instance.parseOptions({startSize: instance.startSize!});
			} catch (e) {}
			expect(spy).toBeCalled();
		});
	});
	describe('parseOptionsStartSize', () => {
		describe('should set startSize if an integer >= 0 is passed', () => {
			const types: any[] = ([0] as any[]).concat(POS_INT_VALUES);
			types.forEach((type) => {
				it(typeof type + ': ' + type, () => {
					instance.parseOptionsStartSize(type);
					expect(instance.startSize).toBe(type);
				});
			});
		});
		describe('should set startSize if anything else is passed', () => {
			const types: any[] = ([] as any[]).concat(NEG_INT_VALUES, FLOAT_VALUES, NAN_VALUES);
			types.forEach((type) => {
				it(typeof type + ': ' + type, () => {
					const startSize = instance.startSize;
					instance.parseOptionsStartSize(type);
					expect(instance.startSize).toBe(startSize);
				});
			});
		});
	});
	describe('parseOptionsState', () => {
		isValidStateRuns((obj) => {
			obj.parseOptionsState(instance.stringify()!);
		});

		it('should return void if state is falsey', () => {
			expect(instance.parseOptionsState(null!)).toBeFalsy();
			expect(instance.parseOptionsState(undefined!)).toBeFalsy();
			expect(instance.parseOptionsState('')).toBeFalsy();
		});

		it('should not run isValidState check and not throw', () => {
			const spy = jest.spyOn(instance, 'isValidState');

			spy.mockClear();
			expect(() => {
				instance.parseOptionsState(instance.state);
			}).not.toThrow();
			expect(spy).not.toBeCalled();
		});

		it('should throw if state is not valid', () => {
			expect(() => {
				instance.parseOptionsState({} as any);
			}).toThrow();
			expect(() => {
				instance.parseOptionsState('{}');
			}).toThrow();
			const stateString = instance.stringify()!;
			const stateObject = instance.parse(stateString)!;
			stateObject.maxSize = null!;
			expect(() => {
				instance.parseOptionsState(stateString.replace(/elements/, 'elmnts'));
			}).toThrow();
			expect(() => {
				instance.parseOptionsState(stateObject as any);
			}).toThrow();
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
		it('should return true if state is a valid ArmorObjectPoolState', () => {
			const custom = new ArmorObjectPool<poolObjClass>(poolObjClass);
			expect(custom.isValidState(custom.state)).toBe(true);
		});

		it('should return false if state is null or undefined', () => {
			const custom = new ArmorObjectPool<poolObjClass>(poolObjClass);
			const types = [null, undefined];
			types.forEach((type) => {
				custom.state = type!;
				expect(custom.isValidState(custom.state)).toBe(false);
			});
		});

		it('should return false if state.type is not "opState"', () => {
			const custom = new ArmorObjectPool<poolObjClass>(poolObjClass);
			const types = [null, undefined, ''];
			types.forEach((type) => {
				custom.state.type = type as 'opState';
				expect(custom.isValidState(custom.state)).toBe(false);
			});
		});

		describe('should return false if state.objectCount is not an integer >= 0', () => {
			const custom = new ArmorObjectPool<poolObjClass>(poolObjClass);
			const types: any[] = ([] as any[]).concat(NAN_VALUES, FLOAT_VALUES, NEG_INT_VALUES);
			types.forEach((type) => {
				it(typeof type + ': ' + type, () => {
					custom.state.objectCount = type!;
					expect(custom.isValidState(custom.state)).toBe(false);
				});
			});
		});

		describe('should return false if state.maxSize is not an integer >= 1', () => {
			const custom = new ArmorObjectPool<poolObjClass>(poolObjClass);
			const types: any[] = ([0] as any[]).concat(NAN_VALUES, FLOAT_VALUES, NEG_INT_VALUES);
			types.forEach((type) => {
				it(typeof type + ': ' + type, () => {
					custom.state.maxSize = type!;
					expect(custom.isValidState(custom.state)).toBe(false);
				});
			});
		});

		describe('should return false if state.increaseFactor is not a number > 0', () => {
			const custom = new ArmorObjectPool<poolObjClass>(poolObjClass);
			const types = ([] as any[]).concat(NAN_VALUES, NEG_NUM_VALUES);
			types.forEach((type) => {
				it(typeof type + ': ' + type, () => {
					custom.state.increaseFactor = type!;
					expect(custom.isValidState(custom.state)).toBe(false);
				});
			});
		});

		describe('should return false if state.increaseBreakPoint is not (0 <= number <= 1)', () => {
			const custom = new ArmorObjectPool<poolObjClass>(poolObjClass);
			const types = ([2, 2.5] as any[]).concat(NAN_VALUES, NEG_NUM_VALUES);
			types.forEach((type) => {
				it(typeof type + ': ' + type, () => {
					custom.state.increaseBreakPoint = type!;
					expect(custom.isValidState(custom.state)).toBe(false);
				});
			});
		});

		it('should return false if state.elements is not an array', () => {
			const custom = new ArmorObjectPool<poolObjClass>(poolObjClass);
			const types = [{}, null, undefined];
			types.forEach((type) => {
				custom.state.elements = type as Array<poolObjClass>;
				expect(custom.isValidState(custom.state)).toBe(false);
			});
		});
	});

	describe('utilization', () => {
		isValidStateRuns((obj) => {
			obj.utilization(0);
		});

		describe('should return % of objects used as a decimal', () => {
			const types: any[] = ([] as any[]).concat(NUM_VALUES, NAN_VALUES);
			types.forEach((type) => {
				it(typeof type + ': ' + type, () => {
					expect(instance.utilization(type!)).not.toBeNaN();
				});
			});
		});
	});
	describe('isAboveThreshold', () => {
		isValidStateRuns((obj) => {
			obj.isAboveThreshold();
		});

		describe('should always return a boolean', () => {
			const typesTrue: any[] = ([0, '0', '1', '1.5'] as any[]).concat(POS_NUM_VALUES, FALSY_NAN_VALUES);
			typesTrue.forEach((type) => {
				it(typeof type + ': ' + type, () => {
					instance.state.increaseBreakPoint = 0;
					expect(instance.isAboveThreshold(type!)).toBe(true);
				});
			});
			const typesFalse: any[] = (['-1.5', '-1'] as any[]).concat(NEG_NUM_VALUES);
			typesFalse.forEach((type) => {
				it(typeof type + ': ' + type, () => {
					instance.state.increaseBreakPoint = 0;
					expect(instance.isAboveThreshold(type!)).toBe(false);
				});
			});
		});
	});

	describe('get', () => {
		isValidStateRuns((obj) => {
			obj.get();
		});

		it("should return null if pool has no more objects and can't increase", () => {
			instance.clearElements();
			expect(instance.state.autoIncrease).toBe(false);
			instance.state.objectCount = 10;
			expect(instance.state.objectCount).toBe(10);
			expect(instance.state.elements.length).toBe(0);
			expect(instance.get()).toBeNull();
		});

		it('should return 1 element from pool if only 1 is available', () => {
			instance.clearElements();
			expect(instance.state.autoIncrease).toBe(false);
			instance.increase(1);
			expect(instance.state.objectCount).toBe(1);
			expect(instance.state.elements.length).toBe(1);
			expect(instance.get()).not.toBeNull();
			expect(instance.state.elements.length).toBe(0);
		});

		it('should return 1 element from pool if multiple are available', () => {
			expect(instance.state.autoIncrease).toBe(false);
			expect(instance.state.objectCount).toBe(10);
			expect(instance.state.elements.length).toBe(10);
			expect(instance.get()).not.toBeNull();
			expect(instance.state.elements.length).toBe(9);
		});
	});
	describe('allocate', () => {
		isValidStateRuns((obj) => {
			obj.allocate();
		});

		describe('should return n elements from the pool if n >= 0', () => {
			const types: any[] = ([50] as any[]).concat(POS_INT_VALUES);
			types.forEach((type) => {
				it(typeof type + ': ' + type, () => {
					let objs: any[] = [];
					expect(objs.length).toBe(0);

					objs = instance.allocate(type);
					expect(objs.length).toBe(Math.min(type, instance.state.objectCount));
					objs.forEach((obj) => {
						instance.release(obj);
					});

					instance.state.autoIncrease = true;
					objs = instance.allocate(type);
					expect(objs.length).toBe(type);
				});
			});
		});

		describe('should grab 1 element from the pool if n is anything other than an int > 0', () => {
			const types: any[] = ([0] as any[]).concat(FLOAT_VALUES, NAN_VALUES, NEG_INT_VALUES);
			types.forEach((type) => {
				it(typeof type + ': ' + type, () => {
					let objs: any[] = [];
					expect(objs.length).toBe(0);

					objs = instance.allocate(type!);
					expect(objs.length).toBe(1);
					objs.forEach((obj) => {
						instance.release(obj);
					});

					instance.state.autoIncrease = true;
					objs = instance.allocate(type!);
					expect(objs.length).toBe(1);
				});
			});
		});
	});
	describe('increase', () => {
		isValidStateRuns((obj) => {
			obj.increase();
		});

		describe('should do nothing if n is not an integer 1 or greater', () => {
			const types: any[] = ([0] as any[]).concat(FLOAT_VALUES, NAN_VALUES, NEG_NUM_VALUES);
			types.forEach((type) => {
				it(typeof type + ': ' + type, () => {
					expect(instance.state.objectCount).toBe(10);
					instance.increase(type!);
					expect(instance.state.objectCount).toBe(10);
				});
			});
		});

		it('should increase the objectCount by n up to maxSize and create that many new elements', () => {
			expect(instance.state.objectCount).toBe(10);
			expect(instance.state.elements.length).toBe(10);

			instance.increase(1);
			expect(instance.state.objectCount).toBe(11);
			expect(instance.state.elements.length).toBe(11);

			instance.increase(10);
			expect(instance.state.objectCount).toBe(21);
			expect(instance.state.elements.length).toBe(21);
		});
	});

	describe('release', () => {
		it('should call cleanObj and store if cleanObj is defined', () => {
			const spy1 = jest.spyOn(instance, 'store');
			const spy2 = jest.spyOn(instance.poolObj, 'cleanObj');

			spy1.mockClear();
			spy2.mockClear();

			instance.release({} as any);

			expect(spy1).toBeCalled();
			expect(spy2).toBeCalled();
		});

		it('should not call store if cleanObj is not defined', () => {
			const custom = new ArmorObjectPool<poolObjClass>(poolObjClass, {startSize: 0});
			const spy = jest.spyOn(custom, 'store');

			spy.mockClear();

			const cleanObj = custom.poolObj.cleanObj;
			custom.poolObj.cleanObj = undefined as any;
			custom.release({} as any);

			expect(spy).not.toBeCalled();
			custom.poolObj.cleanObj = cleanObj;
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
			expect(instance.parse('{elements:[], type: "opState"}')).toBeNull();
			expect(instance.parse('{}')).toBeNull();
			expect(instance.parse('[1,2,3]')).toBeNull();
		});

		it('should return an ArmorObjectPoolState when a parsable string is passed', () => {
			const string = instance.stringify();
			expect(string).not.toBeNull();
			expect(instance.parse(string as string)).toStrictEqual(JSON.parse(instance.stringify()!));
			const state = [
				'{',
				'"type": "opState",',
				'"elements": [],',
				'"objectCount": 1,',
				'"maxSize": 4,',
				'"autoincrease": true,',
				'"increaseBreakPoint": 0,',
				'"increaseFactor": 1',
				'}'
			].join('');
			expect(instance.parse(state)).toStrictEqual(JSON.parse(state));
		});
	});
	describe('stringify', () => {
		isValidStateRuns((obj) => {
			obj.stringify();
		});

		it('should return null if state is invalid', () => {
			const custom = new ArmorObjectPool<poolObjClass>(poolObjClass);
			custom.state.maxSize = 0;
			expect(custom.stringify()).toBeNull();
			custom.state = null!;
			expect(custom.state).toBeNull();
			expect(custom.stringify()).toBeNull();
			delete custom.state;
			expect(custom.state).toBeUndefined();
			expect(custom.stringify()).toBeNull();
		});

		it('should return the state as a string if it is validated', () => {
			const custom = new ArmorObjectPool<poolObjClass>(poolObjClass);
			expect(JSON.parse(custom.stringify()!)).toEqual({
				type: 'opState',
				elements: [],
				objectCount: 10,
				maxSize: 1000,
				autoIncrease: false,
				increaseFactor: 2,
				increaseBreakPoint: 0.8
			});

			custom.increase(1);
			expect(JSON.parse(custom.stringify()!)).toEqual({
				type: 'opState',
				elements: [],
				objectCount: 11,
				maxSize: 1000,
				autoIncrease: false,
				increaseFactor: 2,
				increaseBreakPoint: 0.8
			});

			custom.increase(2);
			expect(JSON.parse(custom.stringify()!)).toEqual({
				type: 'opState',
				elements: [],
				objectCount: 13,
				maxSize: 1000,
				autoIncrease: false,
				increaseFactor: 2,
				increaseBreakPoint: 0.8
			});

			custom.increase(10);
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
			instance.state.type = 'test' as any;
			instance.state.maxSize = 'test' as any;
			instance.state.autoIncrease = 'test' as any;
			instance.state.increaseBreakPoint = 'test' as any;
			instance.state.increaseFactor = 'test' as any;
			instance.clearElements();
			expect(instance.state.type).toBe('test');
			expect(instance.state.maxSize).toBe('test');
			expect(instance.state.autoIncrease).toBe('test');
			expect(instance.state.increaseBreakPoint).toBe('test');
			expect(instance.state.increaseFactor).toBe('test');
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
			expect(instance.state.elements).not.toEqual([]);
			expect(instance.state.objectCount).not.toBe(0);
			instance.reset();
			expect(instance.state.elements.length).toBe(instance.startSize);
			expect(instance.state.objectCount).toBe(instance.startSize);
		});

		it('should change other state variables to default', () => {
			instance.state.type = 'test' as any;
			instance.state.maxSize = 'test' as any;
			instance.state.autoIncrease = 'test' as any;
			instance.state.increaseBreakPoint = 'test' as any;
			instance.state.increaseFactor = 'test' as any;
			instance.reset();
			expect(instance.state.type).toBe('opState');
			expect(instance.state.maxSize).toBe(1000);
			expect(instance.state.autoIncrease).toBe(false);
			expect(instance.state.increaseBreakPoint).toBe(0.8);
			expect(instance.state.increaseFactor).toBe(2);
		});
	});

	describe('select', () => {});
});
