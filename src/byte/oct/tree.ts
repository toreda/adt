import type {ByteDataStructure} from '../data/structure';
import {ByteEnvelope} from '../envelope';
import {byteEnvelopeDecode} from '../envelope/decode';
import type {ItemCodec} from '../../item/codec';
import {itemCodecValid} from '../../item/codec/valid';
import {OctTree} from '../../oct/tree';
import type {OctTreeLocator} from '../../oct/tree/locator';
import type {OctTreeMethod} from '../../oct/tree/method';
import type {OctTreeOptions} from '../../oct/tree/options';

/**
 * `OctTree` that can always be converted to and from bytes. The item codec
 * is required at construction, so `toBytes()` and `toByteEnvelope()` never
 * fail for lack of one. Everything else is inherited unchanged.
 *
 * Items are encoded in pre-order, each node before its octants. Inserting
 * them back in that order rebuilds the same shape, so decoding and encoding
 * again yields the same bytes.
 *
 * @category Oct Tree
 */
export class ByteOctTree<ItemT> extends OctTree<ItemT> implements ByteDataStructure<ItemT> {
	public readonly codec: ItemCodec<ItemT>;

	/**
	 * @param codec		Converts single items to and from bytes. Required, since
	 * 					items are generic and the tree cannot encode them itself.
	 * @param locator	Reads an item's position, as for `OctTree`. Required.
	 * @param data		Items inserted in order on creation: an array, or the
	 * 					bytes of an envelope produced by `toBytes()`. Any other
	 * 					input is ignored, as are items without a valid position
	 * 					and duplicates when duplicates are not allowed.
	 * @param options	Optional config, as for `OctTree`.
	 * @throws			When `locator` is not a function, when `codec` is missing
	 * 					either function, or when `data` is a byte array that is
	 * 					not a well formed `ByteEnvelope`.
	 */
	constructor(
		codec: ItemCodec<ItemT>,
		locator: OctTreeLocator<ItemT>,
		data?: ItemT[] | Uint8Array | null,
		options?: OctTreeOptions<ItemT> | null
	) {
		super(locator, Array.isArray(data) ? data : null, options);

		if (!itemCodecValid<ItemT>(codec)) {
			throw new Error('ByteOctTree requires an ItemCodec with encode and decode functions');
		}

		this.codec = codec;

		if (data instanceof Uint8Array) {
			this.insertArray(byteEnvelopeDecode(data, codec));
		}
	}

	/**
	 * Same as `OctTree.filter()`, but the new tree keeps this tree's codec as
	 * well as its locator and options.
	 */
	public filter(func: OctTreeMethod<ItemT, boolean>, thisArg?: unknown): ByteOctTree<ItemT> {
		return new ByteOctTree<ItemT>(
			this.codec,
			this.locator,
			this.filterValues(func, thisArg),
			this.options()
		);
	}

	/**
	 * Envelope holding each item's bytes in pre-order, matching `stringify()`.
	 */
	public toByteEnvelope(): ByteEnvelope {
		return ByteEnvelope.encode(this.preOrder(), this.codec.encode);
	}

	/**
	 * Raw bytes of the whole tree: the serialized envelope from
	 * `toByteEnvelope()`. The constructor accepts these bytes.
	 */
	public toBytes(): Uint8Array {
		return this.toByteEnvelope().toBytes();
	}
}
