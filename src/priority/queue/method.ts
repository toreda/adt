import type {PriorityQueue} from '../queue';

/**
 * Callback signature for PriorityQueue `forEach` and `filter`. Mirrors the
 * `Map` / `Set` callbacks: the third argument is the priority queue being
 * walked, not an array. Index is the element's position in heap array order
 * (not priority order), starting at 0.
 *
 * @typeParam ItemT		Item type held by the priority queue.
 * @typeParam U			Callback return type.
 *
 * @category Priority Queue
 */
export type PriorityQueueMethod<ItemT, U> = (element: ItemT, index: number, queue: PriorityQueue<ItemT>) => U;
