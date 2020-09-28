export default interface ADTQueryFilter<T> {
	(value: T): boolean;
}
