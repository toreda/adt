import {isInteger, isNumber} from '../src/utility';

const VALUES = {
	negativeFloat: -1.5,
	positiveFloat: 1.5,
	negativeInteger: -1,
	positiveInteger: 1,
	zero: 0,
	nan: NaN,
	string: '0'
};

describe('Utility Functions', () => {
	describe('isNumber', () => {
		const testTable: any = [
			['negativeFloat', true],
			['positiveFloat', true],
			['negativeInteger', true],
			['positiveInteger', true],
			['zero', true],
			['nan', false],
			['string', false]
		];

		it.each(testTable)('(%s) should return %p', (testData, expectedResult) => {
			const result = isNumber(VALUES[testData]);
			expect(result).toBe(expectedResult);
		});
	});

	describe('isInteger', () => {
		const testTable: any = [
			['negativeFloat', false],
			['positiveFloat', false],
			['negativeInteger', true],
			['positiveInteger', true],
			['zero', true],
			['nan', false],
			['string', false]
		];

		it.each(testTable)('(%s) should return %p', (testData, expectedResult) => {
			const result = isInteger(VALUES[testData]);
			expect(result).toBe(expectedResult);
		});
	});
});

describe('Test Values', () => {
	describe('negativeFloat', () => {
		const value = VALUES['negativeFloat'];

		it('should PASS isNumber', () => {
			expect(isNumber(value)).toBe(true);
		});

		it('should FAIL isInteger', () => {
			expect(isInteger(value)).toBe(false);
		});
	});

	describe('positiveFloat', () => {
		const value = VALUES['positiveFloat'];

		it('should PASS isNumber', () => {
			expect(isNumber(value)).toBe(true);
		});

		it('should FAIL isInteger', () => {
			expect(isInteger(value)).toBe(false);
		});
	});

	describe('negativeInteger', () => {
		const value = VALUES['negativeInteger'];

		it('should PASS isNumber', () => {
			expect(isNumber(value)).toBe(true);
		});

		it('should PASS isInteger', () => {
			expect(isInteger(value)).toBe(true);
		});
	});

	describe('positiveInteger', () => {
		const value = VALUES['positiveInteger'];

		it('should PASS isNumber', () => {
			expect(isNumber(value)).toBe(true);
		});

		it('should PASS isInteger', () => {
			expect(isInteger(value)).toBe(true);
		});
	});

	describe('Zero', () => {
		const value = VALUES['zero'];

		it('should PASS isNumber', () => {
			expect(isNumber(value)).toBe(true);
		});

		it('should PASS isInteger', () => {
			expect(isInteger(value)).toBe(true);
		});
	});

	describe('NaN', () => {
		const value = VALUES['nan'];

		it('should FAIL isNumber', () => {
			expect(isNumber(value)).toBe(false);
		});

		it('should FAIL isInteger', () => {
			expect(isInteger(value)).toBe(false);
		});
	});

	describe('String', () => {
		const value = VALUES['string'];

		it('should FAIL isNumber', () => {
			expect(isNumber(value)).toBe(false);
		});

		it('should FAIL isInteger', () => {
			expect(isInteger(value)).toBe(false);
		});
	});
});
