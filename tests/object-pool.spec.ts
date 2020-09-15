import ArmorObjectPool from '../src/object-pool';
import ArmorObjectPoolInstance from '../src/object-pool-instance';

describe('ArmorObjectPool', () => {
	class poolObjClass {
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
		instance = new ArmorObjectPool(poolObjClass);
	});

	beforeEach(() => {
		instance.reset();
	});

	it('Basic Testing', () => {
		let log: Array<string | null> = [];
		log.push(instance.stringify());

		instance.increase(5);

		log.push(instance.stringify());

		console.log(log.map((v,i)=>(i+1)+') '+v).join('\n'));
	});
});
