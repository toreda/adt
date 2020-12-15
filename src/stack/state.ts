export interface ADTStackState<T> {
	bottom: 0;
	elements: Array<T>;
	size: number;
	top: number;
	type: 'Stack';
}
