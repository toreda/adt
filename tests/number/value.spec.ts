import {numberValue} from '../../src/number/value';

const FALLBACK = 99;

describe('numberValue', () => {
	describe('fallback behavior', () => {
		it('should return fallback when no values are provided', () => {
			expect(numberValue(FALLBACK)).toBe(FALLBACK);
		});

		it('should return fallback when every value is a non-number', () => {
			expect(numberValue(FALLBACK, '1', null, undefined, {}, [], true)).toBe(FALLBACK);
		});

		it('should return fallback when the only value is undefined', () => {
			expect(numberValue(FALLBACK, undefined)).toBe(FALLBACK);
		});

		it('should return fallback when the only value is null', () => {
			expect(numberValue(FALLBACK, null)).toBe(FALLBACK);
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
			expect(numberValue(FALLBACK, value)).toBe(value);
		});
	});

	describe('multiple values', () => {
		it('should return the first value when all values are numbers', () => {
			expect(numberValue(FALLBACK, 1, 2, 3)).toBe(1);
		});

		it('should return the first number value, skipping non-numbers', () => {
			expect(numberValue(FALLBACK, undefined, null, '5', 7, 11)).toBe(7);
		});

		it('should return zero when zero is the first number value', () => {
			expect(numberValue(FALLBACK, undefined, 0, 4)).toBe(0);
		});

		it('should skip NaN and Infinity and return the first finite number', () => {
			expect(numberValue(FALLBACK, NaN, Infinity, 7)).toBe(7);
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
			expect(numberValue(FALLBACK, value)).toBe(FALLBACK);
		});
	});
});
