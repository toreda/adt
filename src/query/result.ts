export interface QueryResult<T> {
	element: T;
	delete: () => void;
	index: () => number | null;
	key: () => string | null;
}
