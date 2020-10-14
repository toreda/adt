export interface ADTQueryFilter<T> {
	(value: T): boolean;
}
