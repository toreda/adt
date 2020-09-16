import ArmorObjectPool from '../src/object-pool';
import ArmorObjectPoolInstance from '../src/object-pool-instance';

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

	it.skip('Basic Testing', () => {
		const log: Array<string | null> = [];
		const logstate = function () {
			log.push(((instance.stringify() as string).match(/"elements":\[.*?\]/) as Array<string>)[0]);
		};

		logstate();
		instance.increase(2);

		logstate();

		const obj = instance.get();
		if (obj) {
			obj.name = 'testing';
			logstate();
			instance.release(obj);
		}

		logstate();

		console.log(log.map((v, i) => i + 1 + ') ' + v).join('\n'));
	});

	describe('constructor', () => {});
	describe('parseOptions', () => {});
	describe('parseOptionsStartSize', () => {});
	describe('parseOptionsState', () => {});

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

	describe('get', () => {});
	describe('allocate', () => {});
	describe('increase', () => {});

	describe('release', () => {});
	describe('store', () => {});

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
			expect(instance.state.increaseBreakPoint).toBe(.8);
			expect(instance.state.increaseFactor).toBe(2);
		});
	});

	describe('select', () => {});
});
