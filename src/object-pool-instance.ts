export default interface ArmorObjectPoolInstance<T> {
	new (): T;
	cleanObj(obj: T): void;
}
