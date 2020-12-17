import {UnavoidableAny} from '../types';
export interface ADTObjectPoolConstructor<T> {
	new (...args: UnavoidableAny[]): T;
}
