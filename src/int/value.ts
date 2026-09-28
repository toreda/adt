import {typeValue} from '@toreda/shared-types';

/**
 * First value that is an integer, or fallback when none is. Integers are
 * finite numbers with no fractional part; NaN and ±Infinity are rejected.
 *
 * @category Validation Helpers
 */
export function intValue(fallback: number, ...values: unknown[]): number {
	return typeValue(
		(value?: unknown): value is number => {
			return Number.isInteger(value);
		},
		fallback,
		...values
	);
}
