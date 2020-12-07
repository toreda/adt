export interface ADTObjectPoolInstance<T> {
	new (...args: unknown[]): T;
	cleanObj(obj: T): void;
}
