import {IterableType} from './iterable-type';

export function makeIterableType<T>(value: T, done: boolean): IterableType<T> {
	return {
		value: value,
		done: typeof done === 'boolean' ? done : true
	};
}
