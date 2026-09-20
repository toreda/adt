import {typeValue} from '@toreda/shared-types';

export function numberValue(fallback: number, ...values: unknown[]): number {
	return typeValue(
		(value?: unknown): value is number => {
			return Number.isFinite(value);
		},
		fallback,
		...values
	);
}
