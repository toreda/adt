import ADTQueue from '../src/queue';
import ADTQueueState from '../src/queue-state';

describe('ADTQueue', () => {
	let instance: ADTQueue<number>;

	let DEFAULT_STATE: ADTQueueState<number>;
	let STATE_PROPERTIES = ['type', 'elements', 'deepClone', 'objectPool'];
	const VALID_SERIALIZED_STATE = [
		'{',
		'"type": "qState",',
		'"elements": [],',
		'"deepClone": true,',
		'"objectPool": true',
		'}'
	].join('');

	function pushToQueue(elements: number[]) {
		elements.forEach((element: number) => {
			instance.push(element);
		});
	}

	beforeAll(() => {
		instance = new ADTQueue<number>();
		DEFAULT_STATE = instance.getDefaultState();
	});

	beforeEach(() => {
		instance.reset();
	});

	describe('Constructor', () => {
		it('should initialize empty queue', () => {
			const custom = new ADTQueue<number>();
			expect(custom.size()).toBe(0);
		});

		it('should initialize queue with provided contents argument', () => {
			const contents = [99910, 49810, 40091];
			const custom = new ADTQueue<number>({elements: contents});

			for (let i = 0; i < contents.length; i++) {
				const result = custom.pop();
				expect(result).toBe(contents[i]);
			}
		});

		it('should initialize empty queue when contents argument is not an array', () => {
			const custom = new ADTQueue<number>(44091 as any);
			expect(custom.size()).toBe(0);
		});
	});

	describe('parseOptions', () => {
		it('should return default properties if options is falsey', () => {
			const defaults = {...DEFAULT_STATE};
			expect(instance.parseOptions()).toStrictEqual(defaults);
			expect(instance.parseOptions(null!)).toStrictEqual(defaults);
			expect(instance.parseOptions(undefined!)).toStrictEqual(defaults);
			expect(instance.parseOptions({} as any)).toStrictEqual(defaults);
		});

		it('should return properties from parsed options', () => {
			const expected1 = JSON.parse(VALID_SERIALIZED_STATE);

			expect(
				instance.parseOptions({
					serializedState: VALID_SERIALIZED_STATE
				})
			).toStrictEqual(expected1);

			const expected2: ADTQueueState<number> = JSON.parse(VALID_SERIALIZED_STATE);
			expected2.elements = [3, 4];
			expected2.deepClone = true;
			expected2.objectPool = true;

			expect(
				instance.parseOptions({
					serializedState: VALID_SERIALIZED_STATE,
					elements: expected2.elements,
					deepClone: expected2.deepClone,
					objectPool: expected2.objectPool
				})
			).toStrictEqual(expected2);
		});
	});

	describe('parseOptionsState', () => {
		it('should return the default state if options is falsey', () => {
			const expected = {...instance.state};
			expect(instance.parseOptionsState(null!)).toStrictEqual(expected);
			expect(instance.parseOptionsState('' as any)).toStrictEqual(expected);
			expect(instance.parseOptionsState(undefined!)).toStrictEqual(expected);
		});

		describe('should throw if serializedState is not valid', () => {
			STATE_PROPERTIES.forEach((v) => {
				it(v + ' is null', () => {
					const state = {...DEFAULT_STATE};
					state[v] = null!;
					const errors = instance.getStateErrors(state);

					expect(() => {
						instance.parseOptionsState({
							serializedState: JSON.stringify(state)
						});
					}).toThrow(errors.join('\n'));
				});
			});
		});

		it('should return serializedState as ADTQueueState if it is valid', () => {
			const expected = JSON.parse(VALID_SERIALIZED_STATE);
			expect(
				instance.parseOptionsState({
					serializedState: VALID_SERIALIZED_STATE
				})
			).toStrictEqual(expected);
		});
	});

	describe('parseOptionsOther', () => {
		it('should return the default state if state is falsey', () => {
			const expected = {...DEFAULT_STATE};
			expect(instance.parseOptionsOther(null!)).toStrictEqual(expected);
			expect(instance.parseOptionsOther('' as any)).toStrictEqual(expected);
			expect(instance.parseOptionsOther(undefined!)).toStrictEqual(expected);
		});

		it('should return passed state if options is null or undefined', () => {
			const types = [null, undefined];
			types.forEach((type) => {
				expect(instance.parseOptionsOther(instance.state, type!)).toStrictEqual(instance.state);
				expect(instance.parseOptionsOther(DEFAULT_STATE as any, type!)).toStrictEqual(DEFAULT_STATE);
				expect(instance.parseOptionsOther(instance.parse(VALID_SERIALIZED_STATE) as any, type!)).toStrictEqual(
					instance.parse(VALID_SERIALIZED_STATE)
				);
			});
		});

		it('should return passed state with values changed to match other passed options', () => {
			const expected: ADTQueueState<number> = {...DEFAULT_STATE};
			expected.elements = [3, 4];
			expected.deepClone = true;
			expected.objectPool = true;

			const result = instance.parseOptionsOther(DEFAULT_STATE, {
				elements: expected.elements,
				deepClone: expected.deepClone,
				objectPool: expected.objectPool
			});

			expect(result).toStrictEqual(expected);
		});

		it('should return passed state with values changed to match other passed options if those are valid', () => {
			const expected: ADTQueueState<number> = {...DEFAULT_STATE};
			expected.elements = [3, 4];

			const result = instance.parseOptionsOther(DEFAULT_STATE, {
				elements: expected.elements,
				deepClone: -1 as any,
				objectPool: null as any
			});

			expect(result).toStrictEqual(expected);
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
			instance.clearElements();
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

	describe('isValidState', () => {
		it('should return true if state is a valid ADTQueueState', () => {
			expect(instance.isValidState(instance.state)).toBe(true);
		});

		it('should return false if state is null or undefined', () => {
			const types = [null, undefined];
			types.forEach((type) => {
				expect(instance.isValidState(type!)).toBe(false);
			});
		});

		describe('should return false if a state property is not valid', () => {
			STATE_PROPERTIES.forEach((v) => {
				it(v + ' is null', () => {
					const state = {...DEFAULT_STATE};
					state[v] = null!;
					expect(instance.isValidState(state)).toBe(false);
				});
			});
		});
	});

	describe('getStateErrors', () => {
		it('should return array of errors if state is falsy', () => {
			const types = [null, undefined];
			types.forEach((type) => {
				expect(instance.getStateErrors(type!)).toContain('state is null or undefined');
			});
		});

		it('should return array of errors if state.type is not "qState"', () => {
			const custom = new ADTQueue<number>();
			const types = [null, undefined, ''];
			types.forEach((type) => {
				custom.state.type = type as any;
				expect(custom.getStateErrors(custom.state)).toContain('state type must be qState');
			});
		});

		it('should return array of errors if state.elements is not an array', () => {
			const custom = new ADTQueue<number>();
			const types = [{}, null, undefined];
			types.forEach((type) => {
				custom.state.elements = type as any;
				expect(custom.getStateErrors(custom.state)).toContain('state elements must be an array');
			});
		});

		it('should return array of errors if state.deepClone is not a boolean', () => {
			const custom = new ADTQueue<number>();
			const types = [{}, '', 0, null, undefined];
			types.forEach((type) => {
				custom.state.deepClone = type as any;
				expect(custom.getStateErrors(custom.state)).toContain('state deepClone must be a boolean');
			});
		});

		it('should return array of errors if state.objectPool is not a boolean', () => {
			const custom = new ADTQueue<number>();
			const types = [{}, '', 0, null, undefined];
			types.forEach((type) => {
				custom.state.objectPool = type as any;
				expect(custom.getStateErrors(custom.state)).toContain('state objectPool must be a boolean');
			});
		});

		it('should return an empty array if state is valid', () => {
			expect(instance.getStateErrors(DEFAULT_STATE)).toStrictEqual([]);
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

		it('should return array of errors if string cant be parsed', () => {
			expect(instance.parse('[4,3,')).toContain('Unexpected end of JSON input');
			expect(instance.parse('{left:f,right:')).toContain('Unexpected token l in JSON at position 1');
		});

		it('should return array of errors when a parsable string does not parse into an ADTQueueState', () => {
			let errors: Array<string> = [];
			let toParse: any;

			errors = instance.getStateErrors({} as any);
			errors.unshift('state is not a valid ADTQueueState');
			expect(instance.parse('"null"')).toStrictEqual(errors);

			errors = instance.getStateErrors({} as any);
			errors.unshift('state is not a valid ADTQueueState');
			expect(instance.parse('"undefined"')).toStrictEqual(errors);

			toParse = '{}';
			errors = instance.getStateErrors(JSON.parse(toParse) as any);
			errors.unshift('state is not a valid ADTQueueState');
			expect(instance.parse(toParse)).toStrictEqual(errors);

			toParse = '{"elements":[], "type": "qState"}';
			errors = instance.getStateErrors(JSON.parse(toParse) as any);
			errors.unshift('state is not a valid ADTQueueState');
			expect(instance.parse(toParse)).toStrictEqual(errors);

			toParse = VALID_SERIALIZED_STATE.replace('true', '-5');
			errors = instance.getStateErrors(JSON.parse(toParse) as any);
			errors.unshift('state is not a valid ADTQueueState');
			expect(instance.parse(toParse)).toStrictEqual(errors);
		});

		it('should return an ADTQueueState when a parsable string is passed', () => {
			const string = instance.stringify();
			const expected = {...instance.state};
			expected.elements = [];
			expect(string!).not.toBeNull();
			expect(instance.parse(string as any)).toStrictEqual(expected);
			expect(instance.parse(VALID_SERIALIZED_STATE)).toStrictEqual(JSON.parse(VALID_SERIALIZED_STATE));
		});
	});

	describe('stringify', () => {
		describe('should return null if state is invalid', () => {
			const custom = new ADTQueue<number>();
			STATE_PROPERTIES.forEach((type) => {
				it(typeof type + ': ' + type, () => {
					custom.reset();
					custom.state[type] = null as any;
					expect(custom.stringify()).toBeNull();
				});
			});
		});

		it('should return the state as a string if it is validated', () => {
			const custom = new ADTQueue<number>();
			const expected: ADTQueueState<number> = {
				type: 'qState',
				elements: [],
				deepClone: false,
				objectPool: false
			};

			expect(JSON.parse(custom.stringify()!)).toStrictEqual(expected);

			custom.push(1);
			expected.elements = [1];
			expect(JSON.parse(custom.stringify()!)).toStrictEqual(expected);

			custom.push(2);
			expected.elements = [1, 2];
			expect(JSON.parse(custom.stringify()!)).toStrictEqual(expected);

			custom.pop();
			expected.elements = [2];
			expect(JSON.parse(custom.stringify()!)).toStrictEqual(expected);
		});
	});

	describe('clearElements', () => {
		it('should not throw when queue is empty', () => {
			expect(instance.size()).toBe(0);
			expect(() => {
				instance.reset();
			}).not.toThrow();
		});

		it('should remove all items from queue', () => {
			expect(instance.size()).toBe(0);
			const items = [1, 2, 3, 4, 5, 6, 7];

			items.forEach((item: number) => {
				instance.push(item);
			});

			expect(instance.front()).toBe(items[0]);
			instance.reset();
			expect(instance.size()).toBe(0);
		});
	});

	describe('reset', () => {
		it('should not throw when queue is empty', () => {
			expect(instance.size()).toBe(0);
			expect(() => {
				instance.reset();
			}).not.toThrow();
		});

		it('should remove all items from queue', () => {
			expect(instance.size()).toBe(0);
			const items = [1, 2, 3, 4, 5, 6, 7];

			items.forEach((item: number) => {
				instance.push(item);
			});

			expect(instance.front()).toBe(items[0]);
			instance.reset();
			expect(instance.size()).toBe(0);
		});
	});

	describe('execute', () => {
		let callable: any;

		beforeAll(() => {
			callable = jest.fn().mockImplementation(
				(element: any, ndx: number) =>
					new Promise((resolve, reject) => {
						resolve();
					})
			);
		});

		beforeEach(() => {
			callable.mockReset();
		});
	});

	describe('executeOnAll', () => {
		let callable: any;

		beforeAll(() => {
			callable = jest.fn().mockImplementation(
				(element: any, ndx: number) =>
					new Promise((resolve, reject) => {
						resolve();
					})
			);
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

		it('should execute callable once per element', async () => {
			expect(callable).not.toHaveBeenCalled();
			const elements = [440194, 11129, 321330];
			const custom = new ADTQueue({elements: elements});

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
			const custom = new ADTQueue<number>();
			custom.executeSync(callable, null);
			expect(callable).not.toHaveBeenCalled();
		});

		it('should execute callable once when queue has one item', () => {
			const custom = new ADTQueue<number>();
			custom.push(31091);
			custom.executeSync(callable, null);
			expect(callable).toHaveBeenCalledTimes(1);
		});

		it('should execute callable once for every item in queue', () => {
			const custom = new ADTQueue<number>();
			custom.push(11201);
			custom.push(22081);
			custom.push(333100);
			custom.executeSync(callable, null);
			expect(callable).toHaveBeenCalledTimes(3);
		});
	});
});
