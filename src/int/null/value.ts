import {typeValue} from '../../type/value';

/**
 * First value that is an integer or null, or fallback when none is. Integers
 * are finite numbers with no fractional part; NaN and ±Infinity are rejected.
 *
 * @category Validation Helpers
 */
export function intNullValue(fallback: number | null, ...values: unknown[]): number | null {
	return typeValue(
		(value?: unknown): value is number | null => {
			return value === null || Number.isInteger(value);
		},
		fallback,
		...values
	);
}
