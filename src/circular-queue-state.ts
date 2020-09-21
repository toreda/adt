export default interface ArmorCircularQueueState<T> {
  type: 'cqState';
  elements: T[];
  overwrite: boolean;
  size: number;
  maxSize: number;
  front: number;
  rear: number;
}
