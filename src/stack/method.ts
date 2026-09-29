import type {Stack} from '../stack';

/**
 * Callback signature for Stack `forEach` and `filter`. Mirrors the
 * `Map` / `Set` callbacks: the third argument is the stack being walked, not
 * an array. Index is the element's position from the top, starting at 0.
 *
 * @typeParam ItemT		Item type held by the stack.
 * @typeParam U			Callback return type.
 *
 * @category Stack
 */
export type StackMethod<ItemT, U> = (element: ItemT, index: number, stack: Stack<ItemT>) => U;
