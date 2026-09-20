import {booleanValue} from '../../boolean/value';
import {Defaults} from '../../defaults';
import {numberValue} from '../../number/value';
import {type CircularQueueStateData} from './state/data';

/**
 * @category Circular Queue
 */

export class CircularQueueState<ItemT> {
	public readonly type: string;
	public rearNdx: number;
	public frontNdx: number;
	public rear: ItemT | null;
	public front: ItemT | null;
	public size: number;
	public overwrite: boolean;
	public maxSize: number;
	public readonly elements: ItemT[];

	constructor(data?: Partial<CircularQueueStateData<ItemT>> | string | null) {
		this.type = 'CircularQueue';
		this.elements = [];

		const parsed = this.parseData(data);

		this.rear = null;
		this.rearNdx = 0;
		this.frontNdx = 0;
		this.front = null;
		this.size = 0;

		this.maxSize = typeof parsed?.maxSize === 'number' ? parsed.maxSize : Defaults.CircularQueue.MaxSize;
		this.overwrite =
			typeof parsed?.overwrite === 'boolean' ? parsed.overwrite : Defaults.CircularQueue.Overwrite;
	}

	private parseData(
		state?: Partial<CircularQueueStateData<ItemT>> | string | null
	): CircularQueueStateData<ItemT> {
		const output: CircularQueueStateData<ItemT> = {
			elements: [],
			type: 'CircularQueue',
			size: 0,
			maxSize: Defaults.CircularQueue.MaxSize,
			overwrite: Defaults.CircularQueue.Overwrite,
			front: 0,
			rear: 0
		};

		try {
			let input: Partial<CircularQueueStateData<ItemT>> = {};

			if (typeof state === 'string') {
				input = JSON.parse(state) as CircularQueueStateData<ItemT>;
			} else if (typeof state === 'object' && state) {
				input = state;
			}

			output.maxSize = numberValue(Defaults.CircularQueue.MaxSize, input.maxSize);
			output.front = numberValue(Defaults.CircularQueue.Front, input.front);
			output.rear = numberValue(Defaults.CircularQueue.Rear, input.rear);
			output.overwrite = booleanValue(Defaults.CircularQueue.Overwrite, input.overwrite);
		} catch (e: unknown) {
			/* 			if (e instanceof Error && Array.isArray(result)) {
				//result.push(e);
			} */
		}

		return output;
	}
}
