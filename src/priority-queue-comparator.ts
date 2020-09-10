export default interface ArmorPriorityQueueComparator<T> {
  (a: T, b: T): boolean;
}
