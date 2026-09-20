/**
 * Instance state values specific to a single `Stack` instance.
 * 
 * @category Stack
 */
export interface StackState<T> {
	elements: Array<T>;
	type: 'Stack';
}
