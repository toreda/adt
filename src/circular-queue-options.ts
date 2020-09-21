import ArmorCircularQueueState from './circular-queue-state';

export default interface ArmorCircularQueueOptions<T> {
	serializedState?: string;

	elements?: [];
	overwrite?: boolean;
  size?: number;
	maxSize?: number;
  front?: number;
  rear?: number;
}
