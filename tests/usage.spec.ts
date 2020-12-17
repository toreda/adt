import {ADTCircularQueue} from '../src/circular-queue';
import {ADTLinkedList} from '../src/linked-list';
import {ADTObjectPool} from '../src/object-pool';
import {ADTObjectPoolInstance} from '../src/object-pool/instance';
import {ADTPriorityQueue} from '../src/priority-queue';
import {ADTQueue} from '../src/queue';
import {ADTStack} from '../src/stack';

const filter = (e: number): boolean => {
	return e % 2 == 0;
};

it.skip('object pool', () => {
	const giant = function () {
		let result = '';

		while (result.length < 5000) {
			result += 'a';
		}

		return result;
	};

	class custom implements ADTObjectPoolInstance {
		public atr!: number;
		public info: any;

		constructor() {
			this.cleanObj();
			this.atr = Math.random();
			this.info = giant();
		}

		public cleanObj(): void {
			this.atr = 0;
		}
	}

	const times: number[] = [];
	times.push(Date.now());

	const pool = new ADTObjectPool(custom, {
		startSize: 1,
		autoIncrease: true,
		maxSize: 10000,
		increaseFactor: 2,
		increaseBreakPoint: 1
	});

	times.push(Date.now());

	const factor = pool.state.increaseFactor;

	let counter = 1;

	for (let i = 0; i < 1; i++) {
		const mode = Math.random() < 0.5;

		if (mode && pool.state.pool.length < pool.state.objectCount) {
			const rand = Math.floor(pool.state.used.length * Math.random());
			const obj = pool.state.used[rand];
			if (obj != null) {
				pool.release(obj);
			}
		} else {
			const obj = pool.allocate();
			if (obj != null) {
				obj.atr = counter++;
			}
		}
	}

	times.push(Date.now());
	pool.cleanUsed();
	const p = pool.state.pool.length;
	const u = pool.state.used.length;
	const t = pool.state.objectCount;
	console.log(
		times.map((time, index, arr) => {
			if (index > 0) {
				return (arr[index] - arr[index - 1]) / 1000;
			}

			return 0;
		}),
		`\n${Math.round(100 * (p / t))}% | ${p} / ${t}`,
		`\n${Math.round(100 * (u / t))}% | ${u} / ${t}`
	);
});

it('stack', () => {
	const data = new ADTStack<number>();
	while (data.size() < 10) data.push(Math.floor(Math.random() * 100));
	console.log(data.state, data.state.elements.join('\n'));
	const even = data.filter(filter);
	console.log(even.state, even.state.elements.join('\n'));
});

it('queue', () => {
	const data = new ADTQueue<number>();
	while (data.size() < 10) data.push(Math.floor(Math.random() * 100));
	console.log(data.state, data.state.elements.join('\n'));
	const even = data.filter(filter);
	console.log(even.state, even.state.elements.join('\n'));
});

it('priority queue', () => {
	const print = function (obj: ADTPriorityQueue<number>): any {
		let longest = 0;
		let count = 1;
		obj.state.elements.forEach((v) => {
			const size = v.toString().length;
			if (longest < size) longest = size;
		});

		while (count < obj.state.elements.length) {
			count *= 2;
		}

		const output: Array<number[]> = [];
		let temp: number[] = [];

		obj.state.elements.forEach((v, i) => {
			if (Math.log2(i + 1) % 1 == 0) {
				output.push(temp);
				temp = [];
			}
			temp.push(v);
		});
		output.push(temp);

		return output
			.map((v, i) => {
				const total = Math.pow(2, i) * 2 - 1;
				const leftpad = ' '.repeat(longest * Math.pow(2, output.length - i - 1) - longest);
				const midpad = ' '.repeat(longest * Math.pow(2, output.length - i) - longest);
				return leftpad + v.map((vv) => ('0'.repeat(longest) + vv).slice(-1 * longest)).join(midpad);
			})
			.join('\n');
	};
	const data = new ADTPriorityQueue<number>((a, b) => a < b);
	while (data.size() < 10) data.push(Math.floor(Math.random() * 100));
	console.log(print(data));
	const even = data.filter(filter);
	console.log(print(even));
});

it('linked list', () => {
	const print = (old: ADTLinkedList<number>): string => {
		const list: number[] = [];
		old.forEach((e) => {
			const v = e.value();
			if (v != null) {
				list.push(v);
			}
		});
		return list.join('\n');
	};
	const data = new ADTLinkedList<number>();
	while (data.size() < 10) data.insert(Math.floor(Math.random() * 100));
	console.log(print(data));
	const even = data.filter(function (e) {
		const v = e.value();
		if (v == null) return false;
		return v % 2 == 0;
	}, data);
	console.log(print(even));
});

it('circular queue', () => {
	const print = (old: ADTCircularQueue<number>): string => {
		const list: number[] = [];
		old.forEach((e) => {
			list.push(e);
		});
		return list.join('\n');
	};
	const data = new ADTCircularQueue<number>();
	while (data.size() < 10) data.push(Math.floor(Math.random() * 100));
	data.pop();
	console.log(data.state, print(data));
	const even = data.filter(filter);
	console.log(even.state, print(even));
});

it.only('should', () => {});
