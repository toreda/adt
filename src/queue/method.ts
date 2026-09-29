import type {Queue} from '../queue';

/**
 * Callback signature for Queue `forEach` and `filter`. Mirrors the `Map` /
 * `Set` callbacks: the third argument is the queue being walked, not an array.
 * Index is the item's position from the front, starting at 0.
 *
 * @typeParam ItemT		Item type held by the queue.
 * @typeParam U			Callback return type.
 *
 * @category Queue
 */
export type QueueMethod<ItemT, U> = (item: ItemT, index: number, queue: Queue<ItemT>) => U;
