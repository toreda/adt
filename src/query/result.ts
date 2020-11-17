export interface ADTQueryResult<T> {
	element: T;
	delete: () => void;
	index: () => number | null;
	key: () => string | null;
}
