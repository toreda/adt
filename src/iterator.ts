import { IterableType } from './queue/iterator';

export interface Iterator<ItemT> {
    next: () => IterableType<ItemT>;
}