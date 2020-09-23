export default interface ADTSearchResult<T> {
	element: T;
	delete: () => void;
	index: () => number | null;
	key: () => string | null;
}