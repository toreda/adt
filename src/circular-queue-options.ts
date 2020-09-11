import ArmorCircularQueueState from './circular-queue-state';

export default interface ArmorCircularQueueOptions<T> {
	state?: ArmorCircularQueueState<T> | string;
}
