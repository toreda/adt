import {numberNullValue} from '../../../src/number/null/value';

const FALLBACK = 99;

describe('numberNullValue', () => {
	describe('fallback behavior', () => {
		it('should return fallback when no values are provided', () => {
			expect(numberNullValue(FALLBACK)).toBe(FALLBACK);
		});

		it('should return null fallback when no values are provided', () => {
			expect(numberNullValue(null)).toBeNull();
		});

		it('should return fallback when every value is a non-number', () => {
			expect(numberNullValue(FALLBACK, '1', undefined, {}, [], true)).toBe(FALLBACK);
		});

		it('should return fallback when the only value is undefined', () => {
			expect(numberNullValue(FALLBACK, undefined)).toBe(FALLBACK);
		});
	});

	describe('null handling', () => {
		it('should return null when the only value is null', () => {
			expect(numberNullValue(FALLBACK, null)).toBeNull();
		});

		it('should return null when null appears before a number value', () => {
			expect(numberNullValue(FALLBACK, null, 5)).toBeNull();
		});

		it('should return null when null follows non-number values', () => {
			expect(numberNullValue(FALLBACK, undefined, 'aa', null)).toBeNull();
		});
	});

	describe('valid values', () => {
		const testTable: any = [
			['positive integer', 14],
			['negative integer', -27],
			['positive float', 3.33],
			['negative float', -9.75],
			['zero', 0],
			['MAX_SAFE_INTEGER', Number.MAX_SAFE_INTEGER],
			['MIN_SAFE_INTEGER', Number.MIN_SAFE_INTEGER]
		];

		it.each(testTable)('should return provided value (%s) instead of fallback', (_label, value) => {
			expect(numberNullValue(FALLBACK, value)).toBe(value);
		});
	});

	describe('multiple values', () => {
		it('should return the first value when all values are numbers', () => {
			expect(numberNullValue(FALLBACK, 1, 2, 3)).toBe(1);
		});

		it('should return the first number value, skipping non-numbers', () => {
			expect(numberNullValue(FALLBACK, undefined, '5', 7, 11)).toBe(7);
		});

		it('should return zero when zero is the first number value', () => {
			expect(numberNullValue(FALLBACK, undefined, 0, 4)).toBe(0);
		});

		it('should skip NaN and Infinity and return the first finite number', () => {
			expect(numberNullValue(FALLBACK, NaN, Infinity, 7)).toBe(7);
		});
	});

	describe('invalid value types', () => {
		const testTable: any = [
			['NaN', NaN],
			['positive Infinity', Infinity],
			['negative Infinity', -Infinity],
			['numeric string', '10'],
			['empty string', ''],
			['boolean true', true],
			['boolean false', false],
			['array of numbers', [1, 2, 3]],
			['object', {value: 1}],
			['BigInt', BigInt(10)]
		];

		it.each(testTable)('should return fallback when value is %s', (_label, value) => {
			expect(numberNullValue(FALLBACK, value)).toBe(FALLBACK);
		});
	});
});
