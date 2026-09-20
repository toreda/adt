export function circularQueueSize(front: number, rear: number, maxSize: number): number {
		if (front === rear) {
			return 0;
		} else if (front < rear) {
			return rear - front;
		} else {
			return maxSize - (front - rear);
		}
}