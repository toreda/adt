import {intNullValue} from '../../../src/int/null/value';

const FALLBACK = 99;

describe('intNullValue', () => {
	describe('fallback behavior', () => {
		it('should return fallback when no values are provided', () => {
			expect(intNullValue(FALLBACK)).toBe(FALLBACK);
		});

		it('should return null fallback when no values are provided', () => {
			expect(intNullValue(null)).toBeNull();
		});

		it('should return fallback when every value is a non-integer', () => {
			expect(intNullValue(FALLBACK, '1', undefined, {}, [], true, 1.5)).toBe(FALLBACK);
		});
	});

	describe('null handling', () => {
		it('should return null when the only value is null', () => {
			expect(intNullValue(FALLBACK, null)).toBeNull();
		});

		it('should return null when null appears before an integer', () => {
			expect(intNullValue(FALLBACK, null, 5)).toBeNull();
		});

		it('should return null when null follows non-integer values', () => {
			expect(intNullValue(FALLBACK, undefined, 2.5, 'aa', null)).toBeNull();
		});
	});

	describe('valid values', () => {
		const testTable: [string, unknown][] = [
			['positive integer', 14],
			['negative integer', -27],
			['zero', 0],
			['MAX_SAFE_INTEGER', Number.MAX_SAFE_INTEGER],
			['MIN_SAFE_INTEGER', Number.MIN_SAFE_INTEGER]
		];

		it.each(testTable)('should return provided value (%s) instead of fallback', (_label, value) => {
			expect(intNullValue(FALLBACK, value)).toBe(value);
		});
	});

	describe('multiple values', () => {
		it('should return the first integer, skipping everything else', () => {
			expect(intNullValue(FALLBACK, undefined, '5', 2.5, NaN, 7, 11)).toBe(7);
		});
	});

	describe('invalid value types', () => {
		const testTable: [string, unknown][] = [
			['positive float', 3.33],
			['negative float', -9.75],
			['NaN', NaN],
			['positive Infinity', Infinity],
			['negative Infinity', -Infinity],
			['numeric string', '10'],
			['boolean true', true],
			['object', {value: 1}],
			['BigInt', BigInt(10)]
		];

		it.each(testTable)('should return fallback when value is %s', (_label, value) => {
			expect(intNullValue(FALLBACK, value)).toBe(FALLBACK);
		});
	});
});
