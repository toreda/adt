import ArmorObjectPool from '../src/object-pool';
import ArmorObjectPoolInstance from '../src/object-pool-instance';

describe('ArmorObjectPool', () => {
	class poolObjClass {
		public name!: string;
		public amount!: number;

		constructor() {
			poolObjClass.cleanObj(this);
		}

		static cleanObj(obj: poolObjClass): void{
			obj.name = '';
			obj.amount = 0;
		}
	}

	let instance: ArmorObjectPool<poolObjClass>;

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

	describe('constructor', () => {})

	describe('isInteger', () => {})

	describe('isValidState', () => {})

	describe('wrapIndex', () => {})

	describe('isEmpty', () => {})
	describe('isFull', () => {})

	describe('front', () => {})
	describe('rear', () => {})

	describe('getIndex', () => {})

	describe('push', () => {})
	describe('pop', () => {})

	describe('parse', () => {})
	describe('stringify', () => {})

	describe('parseOptions', () => {})
	describe('parseOptionsOverwrite', () => {})
	describe('parseOptionsState', () => {})

	describe('clearElements', () => {})
	describe('reset', () => {})
	describe('select', () => {});

});
