import type {ByteDataStructure} from '../data/structure.js';
import {ByteEnvelope} from '../envelope.js';
import {byteEnvelopeDecode} from '../envelope/decode.js';
import {CircularQueue} from '../../circular/queue.js';
import type {CircularQueueMethod} from '../../circular/queue/method.js';
import type {CircularQueueOptions} from '../../circular/queue/options.js';
import type {ItemCodec} from '../../item/codec.js';
import {itemCodecValid} from '../../item/codec/valid.js';

/**
 * `CircularQueue` that can always be converted to and from bytes. The item
 * codec is required at construction, so `toBytes()` and `toByteEnvelope()`
 * never fail for lack of one. Everything else is inherited unchanged.
 *
 * @category Circular Queue
 */
export class ByteCircularQueue<ItemT> extends CircularQueue<ItemT> implements ByteDataStructure<ItemT> {
	public readonly codec: ItemCodec<ItemT>;

	/**
	 * @param codec		Converts single items to and from bytes. Required, since
	 * 					items are generic and the queue cannot encode them itself.
	 * @param data		Items pushed front to rear on creation: an array, or the
	 * 					bytes of an envelope produced by `toBytes()`. Either way,
	 * 					items beyond `maxSize` are handled as `push()` handles
	 * 					them. Any other input is ignored.
	 * @param options	Optional config, as for `CircularQueue`.
	 * @throws			When `codec` is missing either function, or when `data`
	 * 					is a byte array that is not a well formed `ByteEnvelope`.
	 */
	constructor(
		codec: ItemCodec<ItemT>,
		data?: ItemT[] | Uint8Array | null,
		options?: CircularQueueOptions<ItemT> | null
	) {
		super(Array.isArray(data) ? data : null, options);

		if (!itemCodecValid<ItemT>(codec)) {
			throw new Error('ByteCircularQueue requires an ItemCodec with encode and decode functions');
		}

		this.codec = codec;

		if (data instanceof Uint8Array) {
			this.pushArray(byteEnvelopeDecode(data, codec));
		}
	}

	/**
	 * Same as `CircularQueue.filter()`, but the new queue keeps this queue's
	 * codec as well as its options.
	 */
	public filter(func: CircularQueueMethod<ItemT, boolean>, thisArg?: unknown): ByteCircularQueue<ItemT> {
		return new ByteCircularQueue<ItemT>(this.codec, this.filterValues(func, thisArg), this.options());
	}

	/**
	 * Envelope holding each item's bytes, front to rear.
	 */
	public toByteEnvelope(): ByteEnvelope {
		return ByteEnvelope.encode(this.values(), this.codec.encode);
	}

	/**
	 * Raw bytes of the whole queue: the serialized envelope from
	 * `toByteEnvelope()`. The constructor accepts these bytes.
	 */
	public toBytes(): Uint8Array {
		return this.toByteEnvelope().toBytes();
	}
}
