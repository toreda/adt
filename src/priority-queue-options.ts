import ArmorPriorityQueueState from './priority-queue-state';

export default interface ArmorPriorityQueueOptions<T> {
	state?: ArmorPriorityQueueState<T> | string;
}
