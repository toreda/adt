import {BinarySearchTree} from '../../../binary/search/tree';
import type {BinarySearchTreeComparator} from '../../../binary/search/tree/comparator';
import type {BinarySearchTreeMethod} from '../../../binary/search/tree/method';
import type {BinarySearchTreeOptions} from '../../../binary/search/tree/options';
import type {ByteDataStructure} from '../../data/structure';
import {ByteEnvelope} from '../../envelope';
import {byteEnvelopeDecode} from '../../envelope/decode';
import type {ItemCodec} from '../../../item/codec';
import {itemCodecValid} from '../../../item/codec/valid';

/**
 * `BinarySearchTree` that can always be converted to and from bytes. The item
 * codec is required at construction, so `toBytes()` and `toByteEnvelope()`
 * never fail for lack of one. Everything else is inherited unchanged.
 *
 * @remarks
 * Items are encoded in pre-order (node, left, right), not sorted order.
 * Inserting a pre-order sequence into an empty tree rebuilds the same shape,
 * so decoding restores the tree exactly and `toBytes()` round-trips
 * byte-for-byte. Every item is encoded, including null or undefined items,
 * matching `stringify()`.
 *
 * @category Binary Search Tree
 */
export class ByteBinarySearchTree<ItemT> extends BinarySearchTree<ItemT> implements ByteDataStructure<ItemT> {
	public readonly codec: ItemCodec<ItemT>;

	/**
	 * @param codec			Converts single items to and from bytes. Required,
	 * 						since items are generic and the tree cannot encode
	 * 						them itself.
	 * @param comparator	Orders items, as for `BinarySearchTree`.
	 * @param data			Items inserted in array order on creation: an array,
	 * 						or the bytes of an envelope produced by `toBytes()`.
	 * 						Any other input is ignored.
	 * @param options		Optional config, as for `BinarySearchTree`.
	 * @throws				When `codec` is missing either function, when
	 * 						comparator is not a function, or when `data` is a
	 * 						byte array that is not a well formed `ByteEnvelope`.
	 */
	constructor(
		codec: ItemCodec<ItemT>,
		comparator: BinarySearchTreeComparator<ItemT>,
		data?: ItemT[] | Uint8Array | null,
		options?: BinarySearchTreeOptions<ItemT> | null
	) {
		super(comparator, Array.isArray(data) ? data : null, options);

		if (!itemCodecValid<ItemT>(codec)) {
			throw new Error('ByteBinarySearchTree requires an ItemCodec with encode and decode functions');
		}

		this.codec = codec;

		if (data instanceof Uint8Array) {
			this.insertArray(byteEnvelopeDecode(data, codec));
		}
	}

	/**
	 * Same as `BinarySearchTree.filter()`, but the new tree keeps this tree's
	 * codec as well as its comparator and options.
	 */
	public filter(
		func: BinarySearchTreeMethod<ItemT, boolean>,
		thisArg?: unknown
	): ByteBinarySearchTree<ItemT> {
		const tree = new ByteBinarySearchTree<ItemT>(this.codec, this.comparator, null, this.options());
		tree.insertSorted(this.filterValues(func, thisArg));

		return tree;
	}

	/**
	 * Envelope holding each item's bytes in pre-order (node, left, right), so
	 * the constructor can rebuild the same shape.
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
