export interface ADTStackState<T> {
	type: 'Stack';
	elements: Array<T>;
	size: number;
	top: number;
	bottom: 0;
}
