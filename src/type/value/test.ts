/**
 * Type guard signature used by `typeValue` to test each candidate value.
 *
 * @category Validation Helpers
 */
export type TypeValueTest<ValueT = unknown> = (value: unknown) => value is ValueT;
