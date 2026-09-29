import type {TypeValueTest} from './value/test';

/**
 * Returns the first `value` of type `ValueT`, otherwise returns `fallback`.
 * @param testFn
 * @param fallback
 * @param values
 *
 * @category Validation Helpers
 */
export function typeValue<ValueT = unknown>(
	testFn: TypeValueTest<ValueT>,
	fallback: ValueT,
	...values: unknown[]
): ValueT {
	if (typeof testFn !== 'function') {
		return fallback;
	}

	if (!Array.isArray(values) || !values.length) {
		return fallback;
	}

	for (const value of values) {
		if (testFn(value) === true) {
			return value;
		}
	}

	return fallback;
}
