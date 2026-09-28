import {intValue} from '../../src/int/value';

const FALLBACK = 99;

describe('intValue', () => {
	describe('fallback behavior', () => {
		it('should return fallback when no values are provided', () => {
			expect(intValue(FALLBACK)).toBe(FALLBACK);
		});

		it('should return fallback when every value is a non-integer', () => {
			expect(intValue(FALLBACK, '1', null, undefined, {}, [], true, 1.5)).toBe(FALLBACK);
		});

		it('should return fallback when the only value is null', () => {
			expect(intValue(FALLBACK, null)).toBe(FALLBACK);
		});
	});

	describe('valid values', () => {
		const testTable: [string, unknown][] = [
			['positive integer', 14],
			['negative integer', -27],
			['zero', 0],
			['negative zero', -0],
			['float with no fractional part', 5.0],
			['MAX_SAFE_INTEGER', Number.MAX_SAFE_INTEGER],
			['MIN_SAFE_INTEGER', Number.MIN_SAFE_INTEGER]
		];

		it.each(testTable)('should return provided value (%s) instead of fallback', (_label, value) => {
			expect(intValue(FALLBACK, value)).toBe(value);
		});
	});

	describe('multiple values', () => {
		it('should return the first value when all values are integers', () => {
			expect(intValue(FALLBACK, 1, 2, 3)).toBe(1);
		});

		it('should return the first integer, skipping everything else', () => {
			expect(intValue(FALLBACK, undefined, null, '5', 2.5, NaN, Infinity, 7, 11)).toBe(7);
		});

		it('should return zero when zero is the first integer', () => {
			expect(intValue(FALLBACK, undefined, 0, 4)).toBe(0);
		});
	});

	describe('invalid value types', () => {
		const testTable: [string, unknown][] = [
			['positive float', 3.33],
			['negative float', -9.75],
			['tiny fraction', 0.0001],
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
			expect(intValue(FALLBACK, value)).toBe(FALLBACK);
		});
	});
});
