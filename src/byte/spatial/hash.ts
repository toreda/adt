import type {ByteDataStructure} from '../data/structure';
import {ByteEnvelope} from '../envelope';
import {byteEnvelopeDecode} from '../envelope/decode';
import type {ItemCodec} from '../../item/codec';
import {itemCodecValid} from '../../item/codec/valid';
import {SpatialHash} from '../../spatial/hash';
import type {SpatialHashMethod} from '../../spatial/hash/method';
import type {SpatialHashOptions} from '../../spatial/hash/options';
import type {SpatialLocator} from '../../spatial/locator';

/**
 * `SpatialHash` that can always be converted to and from bytes. The item
 * codec is required at construction, so `toBytes()` and `toByteEnvelope()`
 * never fail for lack of one. Everything else is inherited unchanged.
 *
 * Items are encoded in insertion order. Inserting them back in that order
 * restores the same insertion order, so decoding and encoding again yields
 * the same bytes.
 *
 * @category Spatial Hash
 */
export class ByteSpatialHash<ItemT> extends SpatialHash<ItemT> implements ByteDataStructure<ItemT> {
	public readonly codec: ItemCodec<ItemT>;

	/**
	 * @param codec		Converts single items to and from bytes. Required, since
	 * 					items are generic and the hash cannot encode them itself.
	 * @param locator	Reads an item's position, as for `SpatialHash`. Required.
	 * @param data		Items inserted in order on creation: an array, or the
	 * 					bytes of an envelope produced by `toBytes()`. Any other
	 * 					input is ignored, as are items without a valid position.
	 * @param options	Optional config, as for `SpatialHash`.
	 * @throws			When `locator` is not a function, when `codec` is missing
	 * 					either function, or when `data` is a byte array that is
	 * 					not a well formed `ByteEnvelope`.
	 */
	constructor(
		codec: ItemCodec<ItemT>,
		locator: SpatialLocator<ItemT>,
		data?: ItemT[] | Uint8Array | null,
		options?: SpatialHashOptions | null
	) {
		super(locator, Array.isArray(data) ? data : null, options);

		if (!itemCodecValid<ItemT>(codec)) {
			throw new Error('ByteSpatialHash requires an ItemCodec with encode and decode functions');
		}

		this.codec = codec;

		if (data instanceof Uint8Array) {
			this.insertArray(byteEnvelopeDecode(data, codec));
		}
	}

	/**
	 * Same as `SpatialHash.filter()`, but the new hash keeps this hash's codec
	 * as well as its locator and options.
	 */
	public filter(func: SpatialHashMethod<ItemT, boolean>, thisArg?: unknown): ByteSpatialHash<ItemT> {
		return new ByteSpatialHash<ItemT>(
			this.codec,
			this.locator,
			this.filterValues(func, thisArg),
			this.options()
		);
	}

	/**
	 * Envelope holding each item's bytes in insertion order, matching
	 * `stringify()`.
	 */
	public toByteEnvelope(): ByteEnvelope {
		return ByteEnvelope.encode(this.values(), this.codec.encode);
	}

	/**
	 * Raw bytes of the whole hash: the serialized envelope from
	 * `toByteEnvelope()`. The constructor accepts these bytes.
	 */
	public toBytes(): Uint8Array {
		return this.toByteEnvelope().toBytes();
	}
}
