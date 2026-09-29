import type {ByteDataStructure} from '../data/structure';
import {ByteEnvelope} from '../envelope';
import {byteEnvelopeDecode} from '../envelope/decode';
import type {ItemCodec} from '../../item/codec';
import {itemCodecValid} from '../../item/codec/valid';
import {QuadTree} from '../../quad/tree';
import type {QuadTreeLocator} from '../../quad/tree/locator';
import type {QuadTreeMethod} from '../../quad/tree/method';
import type {QuadTreeOptions} from '../../quad/tree/options';

/**
 * `QuadTree` that can always be converted to and from bytes. The item codec
 * is required at construction, so `toBytes()` and `toByteEnvelope()` never
 * fail for lack of one. Everything else is inherited unchanged.
 *
 * Items are encoded in pre-order, each node before its quadrants. Inserting
 * them back in that order rebuilds the same shape, so decoding and encoding
 * again yields the same bytes.
 *
 * @category Quad Tree
 */
export class ByteQuadTree<ItemT> extends QuadTree<ItemT> implements ByteDataStructure<ItemT> {
	public readonly codec: ItemCodec<ItemT>;

	/**
	 * @param codec		Converts single items to and from bytes. Required, since
	 * 					items are generic and the tree cannot encode them itself.
	 * @param locator	Reads an item's position, as for `QuadTree`. Required.
	 * @param data		Items inserted in order on creation: an array, or the
	 * 					bytes of an envelope produced by `toBytes()`. Any other
	 * 					input is ignored, as are items without a valid position
	 * 					and duplicates when duplicates are not allowed.
	 * @param options	Optional config, as for `QuadTree`.
	 * @throws			When `locator` is not a function, when `codec` is missing
	 * 					either function, or when `data` is a byte array that is
	 * 					not a well formed `ByteEnvelope`.
	 */
	constructor(
		codec: ItemCodec<ItemT>,
		locator: QuadTreeLocator<ItemT>,
		data?: ItemT[] | Uint8Array | null,
		options?: QuadTreeOptions<ItemT> | null
	) {
		super(locator, Array.isArray(data) ? data : null, options);

		if (!itemCodecValid<ItemT>(codec)) {
			throw new Error('ByteQuadTree requires an ItemCodec with encode and decode functions');
		}

		this.codec = codec;

		if (data instanceof Uint8Array) {
			this.insertArray(byteEnvelopeDecode(data, codec));
		}
	}

	/**
	 * Same as `QuadTree.filter()`, but the new tree keeps this tree's codec as
	 * well as its locator and options.
	 */
	public filter(func: QuadTreeMethod<ItemT, boolean>, thisArg?: unknown): ByteQuadTree<ItemT> {
		return new ByteQuadTree<ItemT>(
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
