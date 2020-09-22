import ADTStack from '../src/stack';
import ADTStackState from '../src/stack-state';

describe('ADTStack', () => {
	let instance: ADTStack<number>;

	let DEFAULT_STATE: ADTStackState<number>;
	const STATE_PROPERTIES = ['type', 'elements', 'size', 'top', 'bottom'];
	const VALID_SERIALIZED_STATE = [
		'{',
		'"type": "sState",',
		'"elements": [1,2],',
		'"size": 2,',
		'"top": 3,',
		'"bottom": 0',
		'}'
	].join('');

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

	beforeAll(() => {
		instance = new ADTStack<number>();
		DEFAULT_STATE = instance.getDefaultState();
	});

	beforeEach(() => {
		instance.reset();
	});

	describe('Constructor', () => {
		describe('constructor', () => {
			it('should initialize empty queue', () => {
				const custom = new ADTStack<number>();
				expect(custom.state.size).toBe(0);
			});

			it('should initialize queue with provided contents argument', () => {
				const contents = [99910, 49810, 40091];
				const custom = new ADTStack<number>({elements: contents});

				for (let i = 0; i < contents.length; i++) {
					const result = custom.pop();
					expect(result).toBe(contents[contents.length - i - 1]);
				}
			});

			it('should initialize empty queue when contents argument is not an array', () => {
				const custom = new ADTStack<number>(44091 as any);
				expect(custom.state.size).toBe(0);
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

				const expected2: ADTStackState<number> = JSON.parse(VALID_SERIALIZED_STATE);
				expected2.elements = [3, 4];
				expected2.size = 2;
				expected2.top = 3;

				expect(
					instance.parseOptions({
						serializedState: VALID_SERIALIZED_STATE,
						elements: expected2.elements,
						size: expected2.size,
						top: expected2.top
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

			it('should return serializedState as ADTStackState if it is valid', () => {
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
					expect(
						instance.parseOptionsOther(instance.parse(VALID_SERIALIZED_STATE) as any, type!)
					).toStrictEqual(instance.parse(VALID_SERIALIZED_STATE));
				});
			});

			it('should return passed state with values changed to match other passed options', () => {
				const expected: ADTStackState<number> = {...DEFAULT_STATE};
				expected.elements = [3, 4];
				expected.size = 2;
				expected.top = 3;

				const result = instance.parseOptionsOther(DEFAULT_STATE, {
					elements: expected.elements,
					size: expected.size,
					top: expected.top
				});

				expect(result).toStrictEqual(expected);
			});

			it('should return passed state with values changed to match other passed options if those are valid', () => {
				const expected: ADTStackState<number> = {...DEFAULT_STATE};
				expected.elements = [3, 4];

				const result = instance.parseOptionsOther(DEFAULT_STATE, {
					elements: expected.elements,
					size: null as any,
					top: [] as any
				});

				expect(result).toStrictEqual(expected);
			});
		});
	});

	describe('Implementation', () => {
		describe('push', () => {
			it('should return the stack instance', () => {
				expect(instance.push(11141) instanceof ADTStack).toBe(true);
			});

			it('should increase the size for each element added', () => {
				const elements = [111092, 44108914, 11092, 441091, 511091];
				for (let i = 0; i < elements.length; i++) {
					instance.push(elements[i]);
					expect(instance.state.size).toBe(i + 1);
				}
			});
		});

		describe('pop', () => {
			it('should return null when stack is empty', () => {
				expect(instance.state.size).toBe(0);
				expect(instance.pop()).toBeNull();
			});

			it('should decrease the stack size for element popped', () => {
				const elements = [111092, 44108914, 11092, 441091, 511091];
				for (let i = 0; i < elements.length; i++) {
					instance.push(elements[i]);
				}

				let size = elements.length;
				for (let i = 0; i < elements.length; i++) {
					size--;
					instance.pop();
					expect(instance.state.size).toBe(size);
				}
			});
		});

		describe('bottom', () => {
			it('should return null when stack is empty', () => {
				expect(instance.state.size).toBe(0);
				expect(instance.bottom()).toBeNull();
			});

			it('should return the element on bottom of stack', () => {
				expect(instance.state.size).toBe(0);
				const expectedValue = 90110;
				instance.push(expectedValue);
				instance.push(111091);
				instance.push(444209);
				expect(instance.bottom()).toBe(expectedValue);
			});
		});

		describe('top', () => {
			it('should return null when stack is empty', () => {
				expect(instance.state.size).toBe(0);
				expect(instance.top()).toBeNull();
			});

			it('should return the element on top of stack', () => {
				expect(instance.state.size).toBe(0);
				const expectedValue = 661784;
				instance.push(133801);
				instance.push(201901);
				instance.push(expectedValue);
				expect(instance.top()).toBe(expectedValue);
			});

			it('should return element on top of stack after an element is removed', () => {
				expect(instance.state.size).toBe(0);
				const expectedValue = 955510;
				instance.push(441091);
				instance.push(expectedValue);
				instance.push(779188);
				instance.pop();
				expect(instance.top()).toBe(expectedValue);
			});

			it('should return element on top of stack after multiple elements are removed', () => {
				expect(instance.state.size).toBe(0);
				const expectedValue = 1200001;
				instance.push(33311);
				instance.push(442133);
				instance.push(918471);
				instance.push(expectedValue);
				instance.push(11001481);
				instance.push(2220911);
				instance.push(2230182);
				instance.pop();
				instance.pop();
				instance.pop();
				expect(instance.top()).toBe(expectedValue);
			});
		});

		describe('reverse', () => {
			it('should reverse element order', () => {
				const elements = [11091, 448101, 449551, 55801];
				elements.forEach((element: number) => {
					instance.push(element);
				});

				instance.reverse();

				for (let i = 0; i < elements.length; i++) {
					const result = instance.pop();
					expect(result).toBe(elements[i]);
				}
			});

			it('should return stack instance when stack is empty', () => {
				expect(instance.state.size).toBe(0);
				expect(instance.reverse() instanceof ADTStack).toBe(true);
			});

			it('should return stack instance', () => {
				instance.push(44113);
				instance.push(44712);
				instance.push(55710);
				expect(instance.reverse() instanceof ADTStack).toBe(true);
			});
		});
	});

	describe('Helpers', () => {
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
			it('should return true if state is a valid ADTStackState', () => {
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

			it('should return array of errors if state.type is not "sState"', () => {
				const custom = new ADTStack<number>();
				const types = [null, undefined, ''];
				types.forEach((type) => {
					custom.state.type = type as any;
					expect(custom.getStateErrors(custom.state)).toContain('state type must be sState');
				});
			});

			it('should return array of errors if state.elements is not an array', () => {
				const custom = new ADTStack<number>();
				const types = [{}, null, undefined];
				types.forEach((type) => {
					custom.state.elements = type as any;
					expect(custom.getStateErrors(custom.state)).toContain('state elements must be an array');
				});
			});

			describe('should return array of errors if state.size is not an integer >= 0', () => {
				const custom = new ADTStack<number>();
				const types: any[] = ([] as any[]).concat(NAN_VALUES, FLOAT_VALUES, NEG_INT_VALUES);
				types.forEach((type) => {
					it(typeof type + ': ' + type, () => {
						custom.state.size = type!;
						expect(custom.getStateErrors(custom.state)).toContain('state size must be an integer >= 0');
					});
				});
			});

			describe('should return array of errors if state.top is not an integer', () => {
				const custom = new ADTStack<number>();
				const types = ([] as any[]).concat(NAN_VALUES, FLOAT_VALUES);
				types.forEach((type) => {
					it(typeof type + ': ' + type, () => {
						custom.state.top = type!;
						expect(custom.getStateErrors(custom.state)).toContain('state top must be an integer');
					});
				});
			});

			describe('should return array of errors if state.bottom is 0', () => {
				const custom = new ADTStack<number>();
				const types = ([] as any[]).concat(NAN_VALUES, FLOAT_VALUES, NEG_INT_VALUES, POS_INT_VALUES);
				types.forEach((type) => {
					it(typeof type + ': ' + type, () => {
						custom.state.bottom = type!;
						expect(custom.getStateErrors(custom.state)).toContain('state bottom must be 0');
					});
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

			it('should return array of errors when a parsable string does not parse into an ADTStackState', () => {
				let errors: Array<string> = [];
				let toParse: any;

				errors = instance.getStateErrors({} as any);
				errors.unshift('state is not a valid ADTStackState');
				expect(instance.parse('"null"')).toStrictEqual(errors);

				errors = instance.getStateErrors({} as any);
				errors.unshift('state is not a valid ADTStackState');
				expect(instance.parse('"undefined"')).toStrictEqual(errors);

				toParse = '{}';
				errors = instance.getStateErrors(JSON.parse(toParse) as any);
				errors.unshift('state is not a valid ADTStackState');
				expect(instance.parse(toParse)).toStrictEqual(errors);

				toParse = '{"elements":[], "type": "sState"}';
				errors = instance.getStateErrors(JSON.parse(toParse) as any);
				errors.unshift('state is not a valid ADTStackState');
				expect(instance.parse(toParse)).toStrictEqual(errors);

				toParse = VALID_SERIALIZED_STATE.replace('3', '"-5"');
				errors = instance.getStateErrors(JSON.parse(toParse) as any);
				errors.unshift('state is not a valid ADTStackState');
				expect(instance.parse(toParse)).toStrictEqual(errors);
			});

			it('should return an ADTStackState when a parsable string is passed', () => {
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
				const custom = new ADTStack<number>();
				STATE_PROPERTIES.forEach((type) => {
					it(typeof type + ': ' + type, () => {
						custom.reset();
						custom.state[type] = null as any;
						expect(custom.stringify()).toBeNull();
					});
				});
			});

			it('should return the state as a string if it is validated', () => {
				const custom = new ADTStack<number>();
				const expected: ADTStackState<number> = {
					type: 'sState',
					elements: [],
					size: 0,
					top: -1,
					bottom: 0
				};

				expect(JSON.parse(custom.stringify()!)).toStrictEqual(expected);

				custom.push(1);
				expected.elements = [1];
				expected.size = 1;
				expected.top = 0;
				expect(JSON.parse(custom.stringify()!)).toStrictEqual(expected);

				custom.push(2);
				expected.elements = [1, 2];
				expected.size = 2;
				expected.top = 1;
				expect(JSON.parse(custom.stringify()!)).toStrictEqual(expected);

				custom.pop();
				expected.elements = [1, 2];
				expected.size = 1;
				expected.top = 0;
				expect(JSON.parse(custom.stringify()!)).toStrictEqual(expected);
			});
		});

		describe('clearElements', () => {
			it('should not throw when stack is empty', () => {
				expect(instance.state.size).toBe(0);
				expect(() => {
					instance.clearElements();
				}).not.toThrow();
			});

			it('should remove all items from stack', () => {
				expect(instance.state.size).toBe(0);
				const items = [1, 2, 3, 4, 5, 6, 7];

				items.forEach((item: number) => {
					instance.push(item);
				});

				expect(instance.state.top).toBe(items.length - 1);
				instance.clearElements();
				expect(instance.state.size).toBe(0);
			});

			it('should reset top to -1', () => {
				instance.push(1211);
				instance.push(1233);
				instance.push(1255);
				instance.clearElements();
				expect(instance.state.top).toBe(-1);
			});

			it('should reset size to 0', () => {
				instance.push(111);
				instance.push(333);
				instance.push(444);
				instance.clearElements();
				expect(instance.state.size).toBe(0);
			});
		});

		describe('reset', () => {
			it('should not throw when queue is empty', () => {
				expect(instance.state.size).toBe(0);
				expect(() => {
					instance.reset();
				}).not.toThrow();
			});

			it('should remove all items from queue', () => {
				expect(instance.state.size).toBe(0);
				const items = [1, 2, 3, 4, 5, 6, 7];

				items.forEach((item: number) => {
					instance.push(item);
				});

				expect(instance.state.top).toBe(items.length - 1);
				instance.reset();
				expect(instance.state.size).toBe(0);
			});
		});
	});
});
