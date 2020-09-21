import ArmorPriorityQueueState from './priority-queue-state';

export default interface ArmorPriorityQueueOptions<T> {
	serializedState?: string;
	elements?: Array<T>;
}
