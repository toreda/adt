export interface ADTObjectPoolConstructor<T> {
	new (...args: unknown[]): T;
}
