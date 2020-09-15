export default interface ArmorObjectPoolInstance<T extends Object> {
	new (): T;
	cleanObj?(obj: T): void;
}
