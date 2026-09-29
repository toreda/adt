import type {ByteDataStructure} from '../data/structure';
import {ByteEnvelope} from '../envelope';
import {byteEnvelopeDecode} from '../envelope/decode';
import type {ItemCodec} from '../../item/codec';
import {itemCodecValid} from '../../item/codec/valid';
import type {SpatialLocator} from '../../spatial/locator';
import {SpatialMap} from '../../spatial/map';
import type {SpatialMapMethod} from '../../spatial/map/method';
import type {SpatialMapOptions} from '../../spatial/map/options';

/**
 * `SpatialMap` that can always be converted to and from bytes. The item codec
 * is required at construction, so `toBytes()` and `toByteEnvelope()` never
 * fail for lack of one. Everything else is inherited unchanged.
 *
 * Items are encoded in insertion order. Each holds its own cell, so inserting
 * them back in that order refuses none of them and restores the same
 * insertion order: decoding and encoding again yields the same bytes.
 *
 * @category Spatial Map
 */
export class ByteSpatialMap<ItemT> extends SpatialMap<ItemT> implements ByteDataStructure<ItemT> {
	public readonly codec: ItemCodec<ItemT>;

	/**
	 * @param codec		Converts single items to and from bytes. Required, since
	 * 					items are generic and the map cannot encode them itself.
	 * @param locator	Reads an item's position, as for `SpatialMap`. Required.
	 * @param data		Items inserted in order on creation: an array, or the
	 * 					bytes of an envelope produced by `toBytes()`. Any other
	 * 					input is ignored, as are items without a valid position
	 * 					and items refused because their cell is occupied.
	 * @param options	Optional config, as for `SpatialMap`.
	 * @throws			When `locator` is not a function, when `codec` is missing
	 * 					either function, or when `data` is a byte array that is
	 * 					not a well formed `ByteEnvelope`.
	 */
	constructor(
		codec: ItemCodec<ItemT>,
		locator: SpatialLocator<ItemT>,
		data?: ItemT[] | Uint8Array | null,
		options?: SpatialMapOptions | null
	) {
		super(locator, Array.isArray(data) ? data : null, options);

		if (!itemCodecValid<ItemT>(codec)) {
			throw new Error('ByteSpatialMap requires an ItemCodec with encode and decode functions');
		}

		this.codec = codec;

		if (data instanceof Uint8Array) {
			this.insertArray(byteEnvelopeDecode(data, codec));
		}
	}

	/**
	 * Same as `SpatialMap.filter()`, but the new map keeps this map's codec as
	 * well as its locator and options.
	 */
	public filter(func: SpatialMapMethod<ItemT, boolean>, thisArg?: unknown): ByteSpatialMap<ItemT> {
		return new ByteSpatialMap<ItemT>(
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
	 * Raw bytes of the whole map: the serialized envelope from
	 * `toByteEnvelope()`. The constructor accepts these bytes.
	 */
	public toBytes(): Uint8Array {
		return this.toByteEnvelope().toBytes();
	}
}
