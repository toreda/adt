import type {ByteDataStructure} from './data/structure';
import {ByteEnvelope} from './envelope';
import {byteEnvelopeDecode} from './envelope/decode';
import type {ItemCodec} from '../item/codec';
import {itemCodecValid} from '../item/codec/valid';
import {Trie} from '../trie';
import type {TrieKeySelector} from '../trie/key/selector';
import type {TrieMethod} from '../trie/method';
import type {TrieOptions} from '../trie/options';

/**
 * `Trie` that can always be converted to and from bytes. The item codec is
 * required at construction, so `toBytes()` and `toByteEnvelope()` never fail
 * for lack of one. Everything else is inherited unchanged.
 *
 * Items are encoded in key order, matching `stringify()`. A trie's shape
 * depends only on its set of keys, not on insertion order, so decoding
 * rebuilds the same trie and encoding again yields the same bytes. Every
 * item is encoded, including null or undefined items.
 *
 * @category Trie
 */
export class ByteTrie<ItemT> extends Trie<ItemT> implements ByteDataStructure<ItemT> {
	public readonly codec: ItemCodec<ItemT>;

	/**
	 * @param codec			Converts single items to and from bytes. Required,
	 * 						since items are generic and the trie cannot encode
	 * 						them itself.
	 * @param keySelector	Reads each item's key, as for `Trie`. Required.
	 * @param data			Items inserted in order on creation: an array, or the
	 * 						bytes of an envelope produced by `toBytes()`. Any
	 * 						other input is ignored, as are items without a
	 * 						string key. A later item replaces an earlier one with
	 * 						the same key.
	 * @param options		Optional config, as for `Trie`.
	 * @throws				When keySelector is not a function, when `codec` is
	 * 						missing either function, or when `data` is a byte
	 * 						array that is not a well formed `ByteEnvelope`.
	 */
	constructor(
		codec: ItemCodec<ItemT>,
		keySelector: TrieKeySelector<ItemT>,
		data?: ItemT[] | Uint8Array | null,
		options?: TrieOptions<ItemT> | null
	) {
		super(keySelector, Array.isArray(data) ? data : null, options);

		if (!itemCodecValid<ItemT>(codec)) {
			throw new Error('ByteTrie requires an ItemCodec with encode and decode functions');
		}

		this.codec = codec;

		if (data instanceof Uint8Array) {
			this.insertArray(byteEnvelopeDecode(data, codec));
		}
	}

	/**
	 * Same as `Trie.filter()`, but the new trie keeps this trie's codec as well
	 * as its key selector and options.
	 */
	public filter(func: TrieMethod<ItemT, boolean>, thisArg?: unknown): ByteTrie<ItemT> {
		return new ByteTrie<ItemT>(
			this.codec,
			this.keySelector,
			this.filterValues(func, thisArg),
			this.options()
		);
	}

	/**
	 * Envelope holding each item's bytes in key order, matching `stringify()`.
	 */
	public toByteEnvelope(): ByteEnvelope {
		return ByteEnvelope.encode(this.values(), this.codec.encode);
	}

	/**
	 * Raw bytes of the whole trie: the serialized envelope from
	 * `toByteEnvelope()`. The constructor accepts these bytes.
	 */
	public toBytes(): Uint8Array {
		return this.toByteEnvelope().toBytes();
	}
}
