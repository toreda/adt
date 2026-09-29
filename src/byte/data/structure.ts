import {type DataStructure} from '../../data/structure';
import {type ByteEnvelope} from '../envelope';

/**
 * Contract for the byte form of a data structure: a subclass of a base data structure that was
 * constructed with an `ItemCodec` and can therefore always produce, and be
 * rebuilt from, a `ByteEnvelope`. Base data structures never carry these methods, so a
 * missing codec is a compile-time error rather than a runtime null.
 *
 * Envelope layout, validation rules, and the byte class constructor contract
 * are specified in `_specs/byte-envelope.md`.
 *
 * @category Base
 */
export interface ByteDataStructure<ItemT> extends DataStructure<ItemT> {
	/**
	 * Envelope holding every item's bytes, in collection order.
	 */
	toByteEnvelope(): ByteEnvelope;
	/**
	 * Raw bytes of the whole collection, which the byte constructor accepts.
	 * For every data structure whose shape is its item order, this is the
	 * serialized envelope from `toByteEnvelope()`. Graphs also have edges, so
	 * `ByteDirectedGraph` returns a `ByteGraphEnvelope`, which embeds that
	 * envelope and adds edge records.
	 */
	toBytes(): Uint8Array;
}
