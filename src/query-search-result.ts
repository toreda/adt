export default interface ADTSearchResult<T> {
	delete: () => void;
	element: T;
	index?: number | null;
	key?: string | null;
}