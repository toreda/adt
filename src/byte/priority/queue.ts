import type {ByteDataStructure} from '../data/structure';
import {ByteEnvelope} from '../envelope';
import {byteEnvelopeDecode} from '../envelope/decode';
import type {ItemCodec} from '../../item/codec';
import {itemCodecValid} from '../../item/codec/valid';
import {PriorityQueue} from '../../priority/queue';
import type {PriorityQueueComparator} from '../../priority/queue/comparator';
import type {PriorityQueueMethod} from '../../priority/queue/method';
import type {PriorityQueueOptions} from '../../priority/queue/options';

/**
 * `PriorityQueue` that can always be converted to and from bytes. The item
 * codec is required at construction, so `toBytes()` and `toByteEnvelope()`
 * never fail for lack of one. Everything else is inherited unchanged.
 *
 * The envelope holds items in heap array order, as `forEach` visits them.
 * Pushing them back in that order with the same comparator moves nothing, so
 * decoding rebuilds the identical heap and the bytes round-trip exactly.
 *
 * @category Priority Queue
 */
export class BytePriorityQueue<ItemT> extends PriorityQueue<ItemT> implements ByteDataStructure<ItemT> {
	public readonly codec: ItemCodec<ItemT>;

	/**
	 * @param codec			Converts single items to and from bytes. Required, since
	 * 						items are generic and the queue cannot encode them itself.
	 * @param comparator	As for `PriorityQueue`. Required. Comes after the codec
	 * 						since both are required.
	 * @param data			Items pushed on creation: an array, or the bytes of an
	 * 						envelope produced by `toBytes()`. Either way they are
	 * 						added after any `options.elements`. Any other input is
	 * 						ignored.
	 * @param options		Optional config, as for `PriorityQueue`.
	 * @throws				When `comparator` is not a function, when `codec` is
	 * 						missing either function, when `data` is a byte array
	 * 						that is not a well formed `ByteEnvelope`, or when
	 * 						`options.elements` is not an array (as `PriorityQueue` does).
	 */
	constructor(
		codec: ItemCodec<ItemT>,
		comparator: PriorityQueueComparator<ItemT>,
		data?: ItemT[] | Uint8Array | null,
		options?: PriorityQueueOptions<ItemT> | null
	) {
		super(comparator, options ?? undefined);

		if (!itemCodecValid<ItemT>(codec)) {
			throw new Error('BytePriorityQueue requires an ItemCodec with encode and decode functions');
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
	 * Same as `PriorityQueue.filter()`, but the new queue keeps this queue's
	 * codec as well as its comparator.
	 */
	public filter(func: PriorityQueueMethod<ItemT, boolean>, thisArg?: unknown): BytePriorityQueue<ItemT> {
		return this.filterInto(
			new BytePriorityQueue<ItemT>(this.codec, this.comparator, null, this.options()),
			func,
			thisArg
		);
	}

	/**
	 * Envelope holding each item's bytes, in heap array order.
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
