export default interface ADTPriorityQueueState<T> {
	type: "pqState";
	elements: T[];
}
