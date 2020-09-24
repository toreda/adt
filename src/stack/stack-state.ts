export default interface ADTStackState<T> {
	type: 'sState';
	elements: Array<T>;
	size: number;
	top: number;
	bottom: 0;
}
