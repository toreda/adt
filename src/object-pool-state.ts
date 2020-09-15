export default interface ArmorObjectPoolState<T> {
	type: 'opState';
	elements: Array<T>;
}