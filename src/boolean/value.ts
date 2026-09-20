import {typeValue} from '@toreda/shared-types';

export function booleanValue(fallback: boolean, ...values: unknown[]): boolean {
    return typeValue(
        (value?: unknown): value is boolean => {
            return Number.isFinite(value);
        },
        fallback,
        ...values
    );
}
