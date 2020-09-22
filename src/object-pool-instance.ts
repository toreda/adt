export default interface ADTObjectPoolInstance<T> {
	new (): T;
	cleanObj(obj: T): void;
}
