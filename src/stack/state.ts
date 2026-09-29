/**
 * Snapshot of a `Stack` returned by `Stack.state` and serialized by
 * `Stack.stringify()`: the live elements, bottom to top.
 *
 * @category Stack
 */
export interface StackState<T> {
	elements: Array<T>;
	type: 'Stack';
}
