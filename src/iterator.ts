import {IterableType} from './iterable-type';

export interface Iterator<ItemT> {
	next: () => IterableType<ItemT>;
}
