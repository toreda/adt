import {typeValue} from '@toreda/shared-types';

export function booleanValue(fallback: boolean, ...values: unknown[]): boolean {
	return typeValue(
		(value?: unknown): value is boolean => {
			return value === true || value === false;
		},
		fallback,
		...values
	);
}
