import {typeValue} from '@toreda/shared-types';

export function intNullValue(fallback: number, ...values: unknown[]): number | null {
    return typeValue(
        (value?: unknown): value is number | null => {
            if (value === null) {
                return true;
            } else if (typeof value !== 'number') {
                return false;
            }

            return Number.isFinite(value) && value % 1 !== 0;
        },
        fallback,
        ...values
    );
}
