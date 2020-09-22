export default interface ADTStackOptions<T> {
	serializedState?: string;
	elements: Array<T>;
	size: number;
	top: number;
	bottom: number;
}
