import {booleanValue} from '../../src/boolean/value';

describe('booleanValue', () => {
	it('returns the first boolean value', () => {
		expect(booleanValue(true, false)).toBe(false);
		expect(booleanValue(false, true)).toBe(true);
		expect(booleanValue(true, 'x', null, false, true)).toBe(false);
	});

	it('returns the fallback when no value is a boolean', () => {
		expect(booleanValue(true)).toBe(true);
		expect(booleanValue(false, undefined)).toBe(false);
		expect(booleanValue(true, null, 0, 1, 'false', NaN, {})).toBe(true);
	});
});
