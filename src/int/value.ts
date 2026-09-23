import {typeValue} from '@toreda/shared-types';

export function intValue(fallback: number, ...values: unknown[]): number {
    return typeValue(
        (value?: unknown): value is number => {
            if (typeof value !== 'number') {
                return false;
            }

            return Number.isFinite(value) && value % 1 !== 0;
        },
        fallback,
        ...values
    );
}
