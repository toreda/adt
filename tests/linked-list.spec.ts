import { ArmorCollectionQuery } from '../dist/query';
import { ArmorCollectionSelector } from '../src/selector';
import {ArmorLinkedList} from '../src/linked-list';

describe('ArmorLinkedList', () => {
	let instance: ArmorLinkedList<number>;

	beforeAll(() => {
		instance = new ArmorLinkedList<number>();
	});

	beforeEach(() => {
		instance.clear();
	});

	describe('Constructor', () => {
		it('should initialize _head to null when no elements argument provided', () => {
			const custom = new ArmorLinkedList<number>();
			expect(custom._head).toBeNull();
		});

		it('should initialize _tail to null when no elements argument provided', () => {
			const custom = new ArmorLinkedList<number>();
			expect(custom._tail).toBeNull();
		});

		it('should initialize list with provided single element', () => {
			const expectedValue = 66182;
			const custom = new ArmorLinkedList<number>(expectedValue);
			expect(custom!.head()!.value()).toBe(expectedValue);
		});

		it('should initialize list length to 1 when elements argument is a single element', () => {
			const expectedValue = 32145;
			const custom = new ArmorLinkedList<number>(expectedValue);
			expect(custom.length).toBe(1);
		});

		it('should initialize list with elements array argument', () => {
			const elements = [331, 441, 551, 323, 333];
			const custom = new ArmorLinkedList<number>(elements);

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

		describe('clear', () => {
			it('should set _head to null', () => {
				instance.insert(55019);
				expect(instance._head).not.toBeNull();
				instance.clear();
				expect(instance._head).toBeNull();
			});

			it('should set _tail to null', () => {
				instance.insert(66019);
				expect(instance._tail).not.toBeNull();
				instance.clear();
				expect(instance._tail).toBeNull();
			});

			it('should set length to 0', () => {
				instance.insert(66019);
				instance.insert(11102);
				expect(instance.length).toBe(2);
				instance.clear();
				expect(instance.length).toBe(0);
			});

			it('should return the linked list instance', () => {
				const result = instance.clear();
				expect(result instanceof ArmorLinkedList).toBe(true);
				expect(result).toBe(instance);
			});
		});

		describe('reverse', () => {
			it('should return linked list instance when list is empty', () => {
				const result = instance.reverse();
				expect(result instanceof ArmorLinkedList).toBe(true);
				expect(result).toBe(instance);
			});

			it('should return linked list instance when list is not empty', () => {
				instance.insert(11092);
				instance.insert(11440);
				instance.insert(99012);
				const result = instance.reverse();
				expect(result instanceof ArmorLinkedList).toBe(true);
				expect(result).toBe(instance);
			});
		});

		describe('select', () => {
			it('should return an ArmorCollectionSelector instance when no arguments provided', () => {
				expect(instance.select() instanceof ArmorCollectionSelector).toBe(true);
			});

			it('should return an ArmorCollectionSelector instance', () => {
				expect(instance.select() instanceof ArmorCollectionSelector).toBe(true);
			});
		});
	});
});
