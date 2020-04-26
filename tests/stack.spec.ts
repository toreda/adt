import { ArmorStack } from '../src/stack';

describe('ArmorStack', () => {
	let instance: ArmorStack<number>;

	beforeAll(() => {
		instance = new ArmorStack<number>();
	});

	beforeEach(() => {
		instance.clear();
	});

	describe('Constructor', () => {

	});

	describe('Implementation', () => {
		describe('push', () => {
			it('should return the stack instance', () => {
				expect(instance.push(11141) instanceof ArmorStack).toBe(true);
			});

			it('should increase the size for each element added', () => {
				const elements = [111092, 44108914, 11092, 441091, 511091];
				for (let i = 0; i < elements.length; i++) {
					instance.push(elements[i]);
					expect(instance.size).toBe(i + 1);
				}
			});
		});

		describe('pop', () => {
			it('should return null when stack is empty', () => {
				expect(instance.size).toBe(0);
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
					expect(instance.size).toBe(size);
				}
			});
		});

		describe('bottom', () => {
			it('should return null when stack is empty', () => {
				expect(instance.size).toBe(0);
				expect(instance.bottom()).toBeNull();
			});

			it('should return the element on bottom of stack', () => {
				expect(instance.size).toBe(0);
				const expectedValue = 90110;
				instance.push(expectedValue);
				instance.push(111091);
				instance.push(444209);
				expect(instance.bottom()).toBe(expectedValue);
			});
		});

		describe('clear', () => {
			it('should reset size to 0', () => {
				instance.push(111);
				instance.push(333);
				instance.push(444);
				instance.clear();
				expect(instance.size).toBe(0);
			});

			it('should reset top to -1', () => {
				instance.push(1211);
				instance.push(1233);
				instance.push(1255);
				instance.clear();
				expect(instance._top).toBe(-1);
			});

			it('should remove all elements', () => {
				instance.push(1211);
				instance.push(1233);
				instance.push(1255);
				instance.clear();
				expect(instance._elements).toEqual([]);
			});

		});

		describe('top', () => {
			it('should return null when stack is empty', () => {
				expect(instance.size).toBe(0);
				expect(instance.top()).toBeNull();
			});

			it('should return the element on top of stack', () => {
				expect(instance.size).toBe(0);
				const expectedValue = 661784;
				instance.push(133801);
				instance.push(201901);
				instance.push(expectedValue);
				expect(instance.top()).toBe(expectedValue);
			});

			it('should return element on top of stack after an element is removed', () => {
				expect(instance.size).toBe(0);
				const expectedValue = 955510;
				instance.push(441091);
				instance.push(expectedValue);
				instance.push(779188);
				instance.pop();
				expect(instance.top()).toBe(expectedValue);
			});

			it('should return element on top of stack after multiple elements are removed', () => {
				expect(instance.size).toBe(0);
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
				expect(instance.size).toBe(0);
				expect(instance.reverse() instanceof ArmorStack).toBe(true);
			});

			it('should return stack instance', () => {
				instance.push(44113);
				instance.push(44712);
				instance.push(55710);
				expect(instance.reverse() instanceof ArmorStack).toBe(true);
			});
		});
	});
});