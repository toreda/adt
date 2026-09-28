import type {CircularQueue} from '../queue.js';

/**
 * Callback signature for CircularQueue `forEach` and `filter`. Mirrors the
 * `Map` / `Set` callbacks: the third argument is the queue being walked, not
 * an array. Index is the element's position from the front, starting at 0.
 *
 * @typeParam ItemT		Item type held by the queue.
 * @typeParam U			Callback return type.
 *
 * @category Circular Queue
 */
export type CircularQueueMethod<ItemT, U> = (item: ItemT, index: number, queue: CircularQueue<ItemT>) => U;
