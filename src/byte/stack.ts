import type {ByteDataStructure} from './data/structure';
import {ByteEnvelope} from './envelope';
import {byteEnvelopeDecode} from './envelope/decode';
import type {ItemCodec} from '../item/codec';
import {itemCodecValid} from '../item/codec/valid';
import {Stack} from '../stack';
import type {StackMethod} from '../stack/method';
import type {StackOptions} from '../stack/options';

/**
 * `Stack` that can always be converted to and from bytes. The item codec is
 * required at construction, so `toBytes()` and `toByteEnvelope()` never fail
 * for lack of one. Everything else is inherited unchanged.
 *
 * The envelope holds items in collection order, top to bottom, as `forEach`
 * and iteration visit them. The constructor pushes decoded items bottom
 * first, so the rebuilt stack has the same top.
 *
 * @category Stack
 */
export class ByteStack<ItemT> extends Stack<ItemT> implements ByteDataStructure<ItemT> {
	public readonly codec: ItemCodec<ItemT>;

	/**
	 * @param codec		Converts single items to and from bytes. Required, since
	 * 					items are generic and the stack cannot encode them itself.
	 * @param data		Items added on creation: an array pushed bottom to top
	 * 					(the last item becomes the top, like `options.elements`),
	 * 					or the bytes of an envelope produced by `toBytes()`, which
	 * 					rebuild the encoded stack. Either way they go on top of
	 * 					any `options.elements`. Any other input is ignored.
	 * @param options	Optional config, as for `Stack`.
	 * @throws			When `codec` is missing either function, when `data` is a
	 * 					byte array that is not a well formed `ByteEnvelope`, or when
	 * 					`options.elements` is not an array (as `Stack` does).
	 */
	constructor(
		codec: ItemCodec<ItemT>,
		data?: ItemT[] | Uint8Array | null,
		options?: StackOptions<ItemT> | null
	) {
		super(options ?? undefined);

		if (!itemCodecValid<ItemT>(codec)) {
			throw new Error('ByteStack requires an ItemCodec with encode and decode functions');
		}

		this.codec = codec;

		if (Array.isArray(data)) {
			for (let i = 0; i < data.length; i++) {
				this.push(data[i]);
			}
		} else if (data instanceof Uint8Array) {
			// Decoded items are top first; push the bottom one first.
			const items = byteEnvelopeDecode(data, codec);

			for (let i = items.length - 1; i >= 0; i--) {
				this.push(items[i]);
			}
		}
	}

	/**
	 * Same as `Stack.filter()`, but the new stack keeps this stack's codec.
	 */
	public filter(func: StackMethod<ItemT, boolean>, thisArg?: unknown): ByteStack<ItemT> {
		return this.filterInto(new ByteStack<ItemT>(this.codec), func, thisArg);
	}

	/**
	 * Envelope holding each item's bytes, top to bottom.
	 */
	public toByteEnvelope(): ByteEnvelope {
		return ByteEnvelope.encode(this.values(), this.codec.encode);
	}

	/**
	 * Raw bytes of the whole stack: the serialized envelope from
	 * `toByteEnvelope()`. The constructor accepts these bytes.
	 */
	public toBytes(): Uint8Array {
		return this.toByteEnvelope().toBytes();
	}
}
