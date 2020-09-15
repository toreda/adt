export default interface ArmorCircularQueueState<T> {
  type: 'cqState';
  maxSize: number;
  elements: T[];
  front: number;
  rear: number;
  size: number;
}
