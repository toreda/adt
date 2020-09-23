import ADTLinkedList from '../src/linked-list';

describe('ADTLinkedList', () => {
	let instance: ADTLinkedList<number>;

	beforeAll(() => {
		instance = new ADTLinkedList<number>();
	});

	beforeEach(() => {
		instance.reset();
	});

	describe('Constructor', () => {
		it('should initialize _head to null when no elements argument provided', () => {
			const custom = new ADTLinkedList<number>();
			expect(custom._head).toBeNull();
		});

		it('should initialize _tail to null when no elements argument provided', () => {
			const custom = new ADTLinkedList<number>();
			expect(custom._tail).toBeNull();
		});

		it('should initialize list with provided single element', () => {
			const expectedValue = 66182;
			const custom = new ADTLinkedList<number>(expectedValue);
			expect(custom!.head()!.value()).toBe(expectedValue);
		});

		it('should initialize list length to 1 when elements argument is a single element', () => {
			const expectedValue = 32145;
			const custom = new ADTLinkedList<number>(expectedValue);
			expect(custom.length).toBe(1);
		});

		it('should initialize list with elements array argument', () => {
			const elements = [331, 441, 551, 323, 333];
			const custom = new ADTLinkedList<number>(elements);

			let curr = custom.head();
			elements.forEach((element: number) => {
				if (!curr) {
					return;
				}
				expect(curr.value()).toBe(element);
				curr = curr.next();
			});

			expect(custom!.head()!.value()).toBe(elements[0]);
			expect(custom!.tail()!.value()).toBe(elements[elements.length - 1]);
		});
	});

	describe('Implementation', () => {
		describe('head', () => {
			it('should return null on empty list', () => {
				expect(instance.length).toBe(0);
				expect(instance.head()).toBeNull();
			});
		});

		describe('tail', () => {
			it('should return null on empty list', () => {
				expect(instance.length).toBe(0);
				expect(instance.tail()).toBeNull();
			});
		});

		describe('insert', () => {
			it('should increase length by 1', () => {
				expect(instance.length).toBe(0);
				instance.insert(144091);
				expect(instance.length).toBe(1);
			});

			it('should increase length by 1 for each element added', () => {
				expect(instance.length).toBe(0);

				instance.insert(5511091);
				instance.insert(1109415);
				instance.insert(3211095);
				expect(instance.length).toBe(3);
			});

			it('should set head to first element added', () => {
				expect(instance.length).toBe(0);
				const expectedValue = 9481102;
				instance.insert(expectedValue);
				instance.insert(441092);
				instance.insert(889102);
				expect(instance!.head()!.value()).toBe(expectedValue);
			});

			it('should set tail to last element added', () => {
				expect(instance.length).toBe(0);
				const expectedValue = 5512231;
				instance.insert(4921322);
				instance.insert(3341438);
				instance.insert(expectedValue);
				expect(instance!.tail()!.value()).toBe(expectedValue);
			});

			it('should not change head when elements are appended', () => {
				expect(instance.length).toBe(0);

				const expectedValue = 18272;
				const elements = [expectedValue, 1221, 1331, 14441];
				elements.forEach((element: number) => {
					instance.insert(element);
					expect(instance!.head()!.value()).toBe(expectedValue);
				});
			});

			it('should change tail each time a new element appended', () => {
				expect(instance.length).toBe(0);

				const elements = [1141, 1221, 1331, 14441];
				elements.forEach((element: number) => {
					instance.insert(element);
					expect(instance!.tail()!.value()).toBe(element);
				});
			});
		});
		describe('insertAtBack', () => {
			let spy;
			beforeAll(() => {
				spy = jest.spyOn(instance, 'insert');
			});

			beforeEach(() => {
				spy.mockReset();
			});

			afterAll(() => {
				spy.mockRestore();
			});

			it('should pass element argument to insert method', () => {
				expect(spy).not.toHaveBeenCalled();
				const expectedValue = 110924;
				instance.insertAtBack(expectedValue);
				expect(spy).toHaveBeenCalledWith(expectedValue);
			});

			it('should call insert once', () => {
				expect(spy).not.toHaveBeenCalled();
				const expectedValue = 332143;

				instance.insertAtBack(expectedValue);
				expect(spy).toHaveBeenCalledTimes(1);
			});
		});

		describe('insertAtFront', () => {
			it('should increase length by 1', () => {
				expect(instance.length).toBe(0);
				instance.insertAtFront(777182);
				expect(instance.length).toBe(1);
			});

			it('should increase length by 1 for each element inserted', () => {
				expect(instance.length).toBe(0);

				instance.insertAtFront(321555);
				instance.insertAtFront(33221345);
				instance.insertAtFront(4421333);
				expect(instance.length).toBe(3);
			});

			it('should set tail on the first element inserted', () => {
				expect(instance.length).toBe(0);
				const expectedValue = 232171;
				instance.insertAtFront(expectedValue);
				expect(instance!.tail()!.value()).toBe(expectedValue);
			});

			it('should set head to the last element inserted', () => {
				expect(instance.length).toBe(0);
				const expectedValue = 3321495;
				const elements = [expectedValue, 44109, 44092, 99201, 55510];
				elements.forEach((element: number) => {
					instance.insertAtFront(element);
					expect(instance!.head()!.value()).toBe(element);
				});
			});

			it('should not change tail on a non-empty list', () => {
				expect(instance.length).toBe(0);
				const expectedValue = 220190;
				instance.insert(expectedValue);
				const elements = [2093, 40912, 4001];
				elements.forEach((element: number) => {
					instance.insertAtFront(element);
					expect(instance!.tail()!.value()).toBe(expectedValue);
				});
			});
		});

		describe('reset', () => {
			it('should set _head to null', () => {
				instance.insert(55019);
				expect(instance._head).not.toBeNull();
				instance.reset();
				expect(instance._head).toBeNull();
			});

			it('should set _tail to null', () => {
				instance.insert(66019);
				expect(instance._tail).not.toBeNull();
				instance.reset();
				expect(instance._tail).toBeNull();
			});

			it('should set length to 0', () => {
				instance.insert(66019);
				instance.insert(11102);
				expect(instance.length).toBe(2);
				instance.reset();
				expect(instance.length).toBe(0);
			});

			it('should return the linked list instance', () => {
				const result = instance.reset();
				expect(result instanceof ADTLinkedList).toBe(true);
				expect(result).toBe(instance);
			});
		});

		describe('reverse', () => {
			it('should return linked list instance when list is empty', () => {
				const result = instance.reverse();
				expect(result instanceof ADTLinkedList).toBe(true);
				expect(result).toBe(instance);
			});

			it('should return linked list instance when list is not empty', () => {
				instance.insert(11092);
				instance.insert(11440);
				instance.insert(99012);
				const result = instance.reverse();
				expect(result instanceof ADTLinkedList).toBe(true);
				expect(result).toBe(instance);
			});

			it('should reverse the order of the list', () => {
				const list = [1, 2, 3, 4, 5];
				list.forEach((elem) => {
					instance.insert(elem);
				});
				expect(JSON.parse(instance.stringify()!)).toEqual(list);
				list.reverse();
				instance.reverse();
				expect(JSON.parse(instance.stringify()!)).toEqual(list);
			});
		});
	});

	describe('Serialization', () => {
		describe('getStateErrors', () => {
			it('should return array of errors if state is falsy', () => {
				const types = [null, undefined];
				types.forEach((type) => {
					expect(instance.getStateErrors(type!)).toContain('Must be an array');
				});
			});

			it('should return array of errors if elements are not the same type', () => {
				const custom = new ADTLinkedList<any>();
				const items = [{d1: 1}, {d2: 2}, {d3: 3}];
				expect(custom.getStateErrors(items)).toContain('All elements must be the same type');
			});

			it('should return an empty array if state is valid', () => {
				const custom = new ADTLinkedList<any>();
				const items = [{d1: 1}, {d1: 2}, {d1: 3}];
				expect(custom.getStateErrors(items)).toStrictEqual([]);
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
				expect(instance.parse('"null"')).toContain('not a valid ADTLinkedList');
				expect(instance.parse('"undefined"')).toContain('not a valid ADTLinkedList');
				expect(instance.parse('{}')).toContain('not a valid ADTLinkedList');
				expect(instance.parse('[1,"-2",4]')).toContain('not a valid ADTLinkedList');
			});

			describe('should return an ADTStackState when a parsable string is passed', () => {
				const tests = ['[]', '[1, 2]', '[{"d1": 1}, {"d1": 2}]'];
				tests.forEach((test) => {
					it(test, () => {
						const expected = new ADTLinkedList<any>(JSON.parse(test));
						expect(instance.parse(test)).toEqual(expected);
					});
				});
			});
		});

		describe('stringify', () => {
			it('should return a stringified list of all elements', () => {
				const custom = new ADTLinkedList<number>([1, 2, 3]);
				const expected = [1, 2, 3];

				expect(JSON.parse(custom.stringify()!)).toStrictEqual(expected);

				custom.insert(4);
				expected.push(4);
				expect(JSON.parse(custom.stringify()!)).toStrictEqual(expected);

				custom.insertAtFront(0);
				expected.unshift(0);
				expect(JSON.parse(custom.stringify()!)).toStrictEqual(expected);

				custom.clearElements();
				expected.length = 0;
				expect(JSON.parse(custom.stringify()!)).toStrictEqual(expected);
			});
		});
	});
});
