import {type ADT} from '../adt';
import {type ByteEnvelope} from './envelope';

/**
 * Contract for the byte form of an ADT: a subclass of a base ADT that was
 * constructed with an `ItemCodec` and can therefore always produce, and be
 * rebuilt from, a `ByteEnvelope`. Base ADTs never carry these methods, so a
 * missing codec is a compile-time error rather than a runtime null.
 *
 * Envelope layout, validation rules, and the byte class constructor contract
 * are specified in `_specs/byte-envelope.md`.
 *
 * @category Base
 */
export interface ByteADT<ItemT> extends ADT<ItemT> {
	/**
	 * Envelope holding every item's bytes, in collection order.
	 */
	toByteEnvelope(): ByteEnvelope;
	/**
	 * Raw bytes of the whole collection: the serialized envelope from
	 * `toByteEnvelope()`. The byte constructor accepts these bytes.
	 */
	toBytes(): Uint8Array;
}
