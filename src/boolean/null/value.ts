import {typeValue} from '@toreda/shared-types';

export function booleanNullValue(fallback: boolean | null, ...values: unknown[]): boolean | null {
    return typeValue(
        (value?: unknown): value is boolean | null => {
            return value === true || value === false;
        },
        fallback,
        ...values
    );
}
