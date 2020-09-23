export default interface ADTBaseElement<T> {
	value(elementValue?: T): T|null;
}
