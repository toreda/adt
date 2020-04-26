import { ArmorQueue } from '../src/queue';
import {ArmorQueueCallable} from '../src/callable';

const mockItem = 14;

describe('ArmorQueue', () => {
	let instance: ArmorQueue<number>;

	function pushToQueue(elements: number[]) {
		elements.forEach((element: number) => {
			instance.push(element);
		});
	}

	beforeAll(() => {
		instance = new ArmorQueue<number>();
	});

	beforeEach(() => {
		instance.clear();
	});

	describe('Constructor', () => {
		it('should initialize empty queue', () => {
			const custom = new ArmorQueue<number>();
			expect(custom.size()).toBe(0);
		});

		it('should initialize queue with provided contents argument', () => {
			const contents = [99910, 49810, 40091];
			const custom = new ArmorQueue<number>(contents);

			for (let i = 0; i < contents.length; i++) {
				const result = custom.pop();
				expect(result).toBe(contents[i]);
			}
		});

		it('should initialize empty queue when contents argument is not an array', () => {
			const custom = new ArmorQueue<number>(44091 as any);
			expect(custom.size()).toBe(0);
		});
	});

	describe('push', () => {
		it('should add exactly one item to queue when push is called once', () => {
			expect(instance.size()).toBe(0);
			instance.push(14);
			expect(instance.size()).toBe(1);
		});

		it('should add exactly 15 items to queue when push is called 15 times', () => {
			expect(instance.size()).toBe(0);

			const limit = 15;
			for (let i = 0; i < limit; i++) {
				instance.push(Math.floor(Math.random() * 191919));
			}

			expect(instance.size()).toBe(limit);
		});
	});

	describe('pop', () => {
		it('should remove exactly 1 item from queue when pop is called once', () => {
			const limit = 12;
			for (let i = 0; i < limit; i++) {
				instance.push(Math.floor(Math.random() * 191919));
			}
			expect(instance.size()).toBe(limit);
			instance.pop();
			expect(instance.size()).toBe(limit - 1);
		});

		it('should not throw when called on an empty queue', () => {
			expect(instance.size()).toBe(0);
			expect(() => {
				instance.pop();
			}).not.toThrow();
		});

		it('should return null when called on an empty queue', () => {
			expect(instance.size()).toBe(0);
			expect(instance.pop()).toBeNull();
		});

		it('should return the first item in queue', () => {
			const limit = 18;
			const expectedResult = 9841191;

			instance.push(expectedResult);

			for (let i = 0; i < limit; i++) {
				instance.push(Math.floor(Math.random() * 191919));
			}

			expect(instance.pop()).toBe(expectedResult);
		});

		it('should pop each item in the order it was added', () => {
			const items = [1, 2, 3, 4, 5, 6, 7];

			items.forEach((item: number) => {
				instance.push(item);
			});

			for (let i = 0; i < items.length; i++) {
				const result = instance.pop();
				expect(result).toBe(items[i]);
			}
		});

		it('should return null when called after queue is empty', () => {
			const items = [1, 2, 3, 4, 5, 6, 7];

			items.forEach((item: number) => {
				instance.push(item);
			});

			for (let i = 0; i < items.length; i++) {
				const result = instance.pop();
				expect(result).toBe(items[i]);
			}

			expect(instance.pop()).toBeNull();
		});

		it('should return null when called on empty queue repeatedly', () => {
			expect(instance.size()).toBe(0);

			for (let i = 0; i < 5; i++) {
				expect(instance.pop()).toBeNull();
			}
		});
	});

	describe('front', () => {
		it('should return null when queue is empty', () => {
			expect(instance.size()).toBe(0);
			expect(instance.front()).toBeNull();
		});

		it('should return the first queued element', () => {
			const item1 = 1049;
			const item2 = 2029;
			instance.push(item1);
			instance.push(item2);
			expect(instance.front()).toBe(item1);
		});
	});

	describe('isEmpty', () => {
		it('should return true when queue has no items', () => {
			instance.clear();
			expect(instance.size()).toBe(0);
			expect(instance.isEmpty()).toBe(true);
		});

		it('should return false when queue has exactly 1 item', () => {
			expect(instance.size()).toBe(0);
			instance.push(1);
			expect(instance.isEmpty()).toBe(false);
		});

		it('should return false when queue has multiple items', () => {
			instance.push(1);
			instance.push(44);
			instance.push(941);
			expect(instance.isEmpty()).toBe(false);
		});
	});

	describe('clear', () => {
		it('should not throw when queue is empty', () => {
			expect(instance.size()).toBe(0);
			expect(() => {
				instance.clear();
			}).not.toThrow();
		});

		it('should remove all items from queue', () => {
			expect(instance.size()).toBe(0);
			const items = [1, 2, 3, 4, 5, 6, 7];

			items.forEach((item: number) => {
				instance.push(item);
			});

			expect(instance.front()).toBe(items[0]);
			instance.clear();
			expect(instance.size()).toBe(0);
		});
	});

	describe('reverse', () => {
		it('should not throw when queue is empty', () => {
			expect(instance.size()).toBe(0);
			expect(() => {
				instance.reverse();
			}).not.toThrow();
		});

		it('should not affect queue with 1 item', () => {
			const item = 55;
			instance.push(item);
			expect(instance.front()).toBe(item);
			instance.reverse();
			expect(instance.front()).toBe(item);
		});

		it('should not change queue size', () => {
			expect(instance.size()).toBe(0);
			const item = 55;
			instance.push(item);
			expect(instance.size()).toBe(1);
			instance.reverse();
			expect(instance.size()).toBe(1);
		});

		it('should reverse queue content ordering', () => {
			expect(instance.size()).toBe(0);
			const items = [8, 26, 79, 114, 35, 256, 7];

			items.forEach((item: number) => {
				instance.push(item);
			});

			instance.reverse();

			items.reverse();
			for (let i = 0; i < items.length; i++) {
				const result = instance.pop();
				expect(result).toBe(items[i]);
			}
		});
	});

	describe('size', () => {
		it('should return 0 when queue is empty', () => {
			expect(instance.size()).toBe(0);
			expect(instance.size()).toBe(0);
		});

		it('should return the number of items in queue', () => {
			const items = [1, 2, 3, 4, 5, 6, 7];

			items.forEach((item: number) => {
				instance.push(item);
			});

			expect(instance.size()).toBe(items.length);
		});
	});

	describe('execute', () => {
		let callable: any;

		beforeAll(() => {
			callable = jest.fn().mockImplementation((element: any, ndx: number) => new Promise((resolve, reject) => {
				resolve();
			}));
		});

		beforeEach(() => {
			callable.mockReset();
		});


	});

	describe('executeOnAll', () => {
		let callable: any;

		beforeAll(() => {
			callable = jest.fn().mockImplementation((element: any, ndx: number) => new Promise((resolve, reject) => {
				resolve();
			}));
		});

		beforeEach(() => {
			callable.mockReset();
		});

		it('should pass null element argument to execute method', () => {
			const elements = [41091];
			pushToQueue(elements);

			const spy = jest.spyOn(instance, 'execute');
			instance.executeOnAll(callable);
			expect(spy).toHaveBeenCalledWith(expect.anything(), null);
		});

		it('should pass callable argument to execute method', () => {
			const elements = [661987];
			pushToQueue(elements);

			const spy = jest.spyOn(instance, 'execute');
			instance.executeOnAll(callable);
			expect(spy).toHaveBeenCalledWith(callable, null);
		});

		it('should execute callable once per element', async() => {
			expect(callable).not.toHaveBeenCalled();
			const elements = [440194, 11129, 321330];
			const custom = new ArmorQueue(elements);

			expect.assertions(2);

			const spy = jest.spyOn(custom, 'execute');
			await custom.executeOnAll(callable);
			expect(callable).toHaveBeenCalledTimes(3);
		});
	});

	describe('executeOnAllSync', () => {
		let callable: any;

		beforeAll(() => {
			callable = jest.fn().mockImplementation((element: any, ndx: number) => {});
		});

		beforeEach(() => {
			callable.mockReset();
		});

		it('should pass null element argument to execute method', () => {
			const elements = [41091];
			pushToQueue(elements);

			const spy = jest.spyOn(instance, 'executeSync');
			instance.executeOnAllSync(callable);
			expect(spy).toHaveBeenCalledWith(expect.anything(), null);
		});

		it('should pass callable argument to execute method', () => {
			const elements = [661987];
			pushToQueue(elements);

			const spy = jest.spyOn(instance, 'executeSync');
			instance.executeOnAllSync(callable);
			expect(spy).toHaveBeenCalledWith(callable, null);
		});

		it('should execute callable once per element in queue', () => {
			expect(callable).not.toHaveBeenCalled();

			const elements = [41091, 99109, 877110];
			pushToQueue(elements);

			const spy = jest.spyOn(instance, 'executeSync');
			instance.executeOnAllSync(callable);
			expect(callable).toHaveBeenCalledTimes(elements.length);
		});

	});

	describe('executeSync', () => {
		let callable: any;

		beforeAll(() => {
			callable = jest.fn().mockImplementation((element: any, ndx: number) => {});
		});

		beforeEach(() => {
			callable.mockReset();
		});

		it('should not execute the callable when queue is empty', () => {
			const custom = new ArmorQueue<number>();
			custom.executeSync(callable, null);
			expect(callable).not.toHaveBeenCalled();
		});

		it('should execute callable once when queue has one item', () => {
			const custom = new ArmorQueue<number>();
			custom.push(31091);
			custom.executeSync(callable, null);
			expect(callable).toHaveBeenCalledTimes(1);
		});

		it('should execute callable once for every item in queue', () => {
			const custom = new ArmorQueue<number>();
			custom.push(11201);
			custom.push(22081);
			custom.push(333100);
			custom.executeSync(callable, null);
			expect(callable).toHaveBeenCalledTimes(3);
		});
	});
});
