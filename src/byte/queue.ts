import type {ByteDataStructure} from './data/structure';
import {ByteEnvelope} from './envelope';
import {byteEnvelopeDecode} from './envelope/decode';
import type {ItemCodec} from '../item/codec';
import {itemCodecValid} from '../item/codec/valid';
import {Queue} from '../queue';
import type {QueueMethod} from '../queue/method';
import type {QueueOptions} from '../queue/options';

/**
 * `Queue` that can always be converted to and from bytes. The item codec is
 * required at construction, so `toBytes()` and `toByteEnvelope()` never fail
 * for lack of one. Everything else is inherited unchanged.
 *
 * @category Queue
 */
export class ByteQueue<ItemT> extends Queue<ItemT> implements ByteDataStructure<ItemT> {
	public readonly codec: ItemCodec<ItemT>;

	/**
	 * @param codec		Converts single items to and from bytes. Required, since
	 * 					items are generic and the queue cannot encode them itself.
	 * @param data		Items pushed front to rear on creation: an array, or the
	 * 					bytes of an envelope produced by `toBytes()`. Any other
	 * 					input is ignored.
	 * @param options	Optional config, as for `Queue`, passed to it untouched.
	 * 					When `options.elements` is also given, those items are
	 * 					queued first and `data` follows them.
	 * @throws			When `codec` is missing either function, or when `data`
	 * 					is a byte array that is not a well formed `ByteEnvelope`.
	 */
	constructor(
		codec: ItemCodec<ItemT>,
		data?: ItemT[] | Uint8Array | null,
		options?: QueueOptions<ItemT> | null
	) {
		super(options);

		if (!itemCodecValid<ItemT>(codec)) {
			throw new Error('ByteQueue requires an ItemCodec with encode and decode functions');
		}

		this.codec = codec;

		const items = Array.isArray(data)
			? data
			: data instanceof Uint8Array
				? byteEnvelopeDecode(data, codec)
				: null;

		if (items !== null) {
			for (let i = 0; i < items.length; i++) {
				this.push(items[i]);
			}
		}
	}

	/**
	 * Same as `Queue.filter()`, but the new queue keeps this queue's codec.
	 */
	public filter(func: QueueMethod<ItemT, boolean>, thisArg?: unknown): ByteQueue<ItemT> {
		const result = new ByteQueue<ItemT>(this.codec, null, this.options());
		this.filterInto(result, func, thisArg);

		return result;
	}

	/**
	 * Envelope holding each item's bytes, front to rear. Every item is encoded,
	 * matching `stringify()`, so a `null` item is passed to the codec.
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
