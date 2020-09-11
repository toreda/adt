import ArmorCircularQueue from '../src/circular-queue';

describe('ArmorCircularQueue', () => {
	let instance: ArmorCircularQueue<number>;
	const items = [90, 70, 50, 30, 10, 80, 60, 40, 20];
	const maxSize = 5;

	beforeAll(() => {
		instance = new ArmorCircularQueue<number>(maxSize);
	});

	beforeEach(() => {
		instance.clear();
	});

	it('Test Basic Functionality', () => {
		let str = '';
		instance.push(1);
		str += 'push: 1 \n'
		instance.push(2);
		str += 'push: 2 \n'
		instance.push(3);
		str += 'push: 3 \n'
		instance.push(4);
		str += 'push: 4 \n'
		instance.push(5);
		str += 'push: 5 \n'
		str += instance.stringify() + '\n';
		str += 'size: ' + instance.size() + '\n';
		instance.push(6);
		str += 'push: 6 \n'
		str += instance.stringify() + '\n';
		str += 'size: ' + instance.size() + '\n';
		str += 'pop: ' + instance.pop() + '\n';
		str += 'pop: ' + instance.pop() + '\n';
		str += 'size: ' + instance.size() + '\n';
		instance.push(7);
		str += 'push: 7 \n'
		str += instance.stringify() + '\n';
		str += 'size: ' + instance.size() + '\n';
		str += 'pop: ' + instance.pop() + '\n';
		str += 'pop: ' + instance.pop() + '\n';
		str += 'pop: ' + instance.pop() + '\n';
		str += instance.stringify() + '\n';
		str += 'size: ' + instance.size() + '\n';
		str += 'pop: ' + instance.pop() + '\n';
		str += instance.stringify() + '\n';
		str += 'size: ' + instance.size() + '\n';
		console.log(str)
	});
});
