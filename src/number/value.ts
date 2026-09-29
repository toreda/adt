import {typeValue} from '../type/value';

export function numberValue(fallback: number, ...values: unknown[]): number {
	return typeValue(
		(value?: unknown): value is number => {
			return Number.isFinite(value);
		},
		fallback,
		...values
	);
}
