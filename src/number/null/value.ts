import {typeValue} from '@toreda/shared-types';

export function numberNullValue(fallback: number | null, ...values: unknown[]): number | null {
	return typeValue(
		(value?: unknown): value is number | null => {
			return value === null || Number.isFinite(value);
		},
		fallback,
		...values
	);
}
