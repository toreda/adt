import {ADTObjectPool} from '../src/object-pool';
import {ADTObjectPoolInstance} from '../src/object-pool/instance';
import {ADTObjectPoolOptions} from '../src/object-pool/options';

const repeat = (n, f): void => {
	while (n-- > 0) f();
};

class objectClass implements ADTObjectPoolInstance {
	public atr1: any;
	public atr2: any;
	public atr3 = '';

	constructor(arg1, arg2) {
		this.atr1 = arg1;
		this.atr2 = arg2;
	}

	cleanObj(): void {
		this.atr1 = options.instanceArgs[0];
		this.atr2 = options.instanceArgs[1];
		this.atr3 = '';
	}
}

const options: Required<Omit<ADTObjectPoolOptions, 'serializedState'>> = {
	autoIncrease: false,
	increaseBreakPoint: 0.8,
	increaseFactor: 2,
	instanceArgs: ['banana', 1337],
	maxSize: 10000,
	startSize: 100
};

const pool = new ADTObjectPool(objectClass, options);

const checkArgs = (): void => {
	let correct = true;
	pool.forEach((obj) => {
		if (obj.atr1 != options.instanceArgs[0]) correct = false;
		if (obj.atr2 != options.instanceArgs[1]) correct = false;
	});
	console.log(correct);
};

let groupCount = 1;
const getGroup = (): string => `${groupCount}-`;
const usage = (): void => {
	console.log(pool.state.used.length);
	console.log(pool.utilization());
};

repeat(96, () => {
	const item = pool.allocate();
	if (item == null) return;
	item.atr3 += getGroup();
});
groupCount++;
checkArgs();
usage();

pool.releaseMultiple(pool.map().slice(24));
usage();

repeat(60, () => {
	const item = pool.allocate();
	if (item == null) return;
	item.atr3 += getGroup();
});
groupCount++;
checkArgs();

pool.forEach((obj) => (obj.atr3 += getGroup()));
groupCount++;
checkArgs();

usage();
console.log(pool.map((o) => o.atr3.slice(0, -1).trim()));

pool.releaseMultiple(pool.map());
usage();

const active = pool.allocateMultiple(96);
active.forEach((obj) => (obj.atr3 += getGroup()));
groupCount++;
checkArgs();
pool.forEach((obj) => (obj.atr3 += getGroup()));
groupCount++;
checkArgs();

console.log(pool.map((o) => o.atr3.slice(0, -1).trim()));
