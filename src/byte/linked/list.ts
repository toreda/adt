import type {ArrayMethod} from '../../array/method';
import type {ByteADT} from '../adt';
import {ByteEnvelope} from '../envelope';
import {byteEnvelopeDecode} from '../envelope/decode';
import type {ItemCodec} from '../../item/codec';
import {itemCodecValid} from '../../item/codec/valid';
import {LinkedList} from '../../linked/list';
import type {LinkedListElement} from '../../linked/list/element';
import type {LinkedListOptions} from '../../linked/list/options';

/**
 * `LinkedList` that can always be converted to and from bytes. The item codec
 * is required at construction, so `toBytes()` and `toByteEnvelope()` never
 * fail for lack of one. Everything else is inherited unchanged.
 *
 * @category Linked List
 */
export class ByteLinkedList<ItemT> extends LinkedList<ItemT> implements ByteADT<ItemT> {
	public readonly codec: ItemCodec<ItemT>;

	/**
	 * @param codec		Converts single items to and from bytes. Required, since
	 * 					items are generic and the list cannot encode them itself.
	 * @param data		Items inserted head to tail on creation: an array, or the
	 * 					bytes of an envelope produced by `toBytes()`. Any other
	 * 					input is ignored.
	 * @param options	Optional config, as for `LinkedList`.
	 * @throws			When `codec` is missing either function, or when `data`
	 * 					is a byte array that is not a well formed `ByteEnvelope`.
	 */
	constructor(
		codec: ItemCodec<ItemT>,
		data?: ItemT[] | Uint8Array | null,
		options?: LinkedListOptions<ItemT> | null
	) {
		super(Array.isArray(data) ? data : null, options);

		if (!itemCodecValid<ItemT>(codec)) {
			throw new Error('ByteLinkedList requires an ItemCodec with encode and decode functions');
		}

		this.codec = codec;

		if (data instanceof Uint8Array) {
			this.insertArray(byteEnvelopeDecode(data, codec));
		}
	}

	/**
	 * Same as `LinkedList.filter()`, but the new list keeps this list's codec.
	 */
	public filter(
		func: ArrayMethod<LinkedListElement<ItemT>, boolean>,
		thisArg?: unknown
	): ByteLinkedList<ItemT> {
		return new ByteLinkedList<ItemT>(this.codec, this.filterValues(func, thisArg));
	}

	/**
	 * Envelope holding each value's bytes, head to tail. Elements whose value
	 * is null are skipped, matching `stringify()`.
	 */
	public toByteEnvelope(): ByteEnvelope {
		return ByteEnvelope.encode(this.values(), this.codec.encode);
	}

	/**
	 * Raw bytes of the whole list: the serialized envelope from
	 * `toByteEnvelope()`. The constructor accepts these bytes.
	 */
	public toBytes(): Uint8Array {
		return this.toByteEnvelope().toBytes();
	}
}
