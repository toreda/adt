import {IterableType} from './type';

/**
 *
 * @param value
 * @param done
 * @returns
 *
 * @category Base
 */
export function iterableMakeType<T>(value: T, done: boolean): IterableType<T> {
	return {
		value: value,
		done: typeof done === 'boolean' ? done : true
	};
}
