import ArmorObjectPool from '../src/object-pool';
import ArmorObjectPoolInstance from '../src/object-pool-instance';

describe('ArmorObjectPool', () => {
	class poolObjClass{
		public name!: string;
		public amount!: number;

		constructor() {
			this.cleanObj(this);
		}

		cleanObj(obj: poolObjClass): void {
			this.name = '';
			this.amount = 0;
		}
	}

	let instance: ArmorObjectPool<poolObjClass>;

	beforeAll(() => {
		instance = new ArmorObjectPool(poolObjClass as ArmorObjectPoolInstance<poolObjClass>);
	});

	beforeEach(() => {
		instance.reset();
	});

	it('Basic Testing', () => {
		const log: Array<string | null> = [];
		const logstate = function () {
			log.push(instance.stringify());
		};

		logstate();
		instance.increase(2);
		
		logstate();
		
		const obj = instance.get();
		if (obj){
		obj.name = 'testing';
		}
		logstate();

		instance.release(obj);
		logstate();

		console.log(log.map((v, i) => i + 1 + ') ' + v).join('\n'));
	});
});
