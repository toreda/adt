/**
 * Callback signature shared by array-style data structure methods such as forEach, filter,
 * and map. Mirrors the callback passed to the equivalent Array.prototype methods.
 *
 * @typeParam T		Element type passed to the callback.
 * @typeParam U		Callback return type.
 *
 * @category Base
 */
export type ArrayMethod<T, U> = (element: T, index: number, arr: T[]) => U;
