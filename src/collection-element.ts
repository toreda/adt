export default interface ADTCollectionElement<T> {
	value(elementValue?: T): T|null;
}
