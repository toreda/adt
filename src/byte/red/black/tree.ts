import type {ByteDataStructure} from '../../data/structure';
import {ByteEnvelope} from '../../envelope';
import {byteEnvelopeDecode} from '../../envelope/decode';
import type {ItemCodec} from '../../../item/codec';
import {itemCodecValid} from '../../../item/codec/valid';
import {RedBlackTree} from '../../../red/black/tree';
import type {RedBlackTreeComparator} from '../../../red/black/tree/comparator';
import type {RedBlackTreeMethod} from '../../../red/black/tree/method';
import type {RedBlackTreeOptions} from '../../../red/black/tree/options';

/**
 * `RedBlackTree` that can always be converted to and from bytes. The item
 * codec is required at construction, so `toBytes()` and `toByteEnvelope()`
 * never fail for lack of one. Items are encoded in sorted order. Everything
 * else is inherited unchanged.
 *
 * @category Red Black Tree
 */
export class ByteRedBlackTree<ItemT> extends RedBlackTree<ItemT> implements ByteDataStructure<ItemT> {
	public readonly codec: ItemCodec<ItemT>;

	/**
	 * @param codec			Converts single items to and from bytes. Required, since
	 * 						items are generic and the tree cannot encode them
	 * 						itself.
	 * @param comparator	Orders items, as for `RedBlackTree`. Required.
	 * @param data			Items inserted on creation: an array, inserted in array
	 * 						order, or the bytes of an envelope produced by
	 * 						`toBytes()`. Envelope items already in sorted order are
	 * 						linked into a balanced tree in O(n); any other order is
	 * 						inserted one by one. Either way, duplicates are skipped
	 * 						when duplicates are not allowed. Any other input is
	 * 						ignored.
	 * @param options		Optional config, as for `RedBlackTree`.
	 * @throws				When comparator is not a function, when `codec` is
	 * 						missing either function, or when `data` is a byte
	 * 						array that is not a well formed `ByteEnvelope`.
	 */
	constructor(
		codec: ItemCodec<ItemT>,
		comparator: RedBlackTreeComparator<ItemT>,
		data?: ItemT[] | Uint8Array | null,
		options?: RedBlackTreeOptions<ItemT> | null
	) {
		super(comparator, Array.isArray(data) ? data : null, options);

		if (!itemCodecValid<ItemT>(codec)) {
			throw new Error('ByteRedBlackTree requires an ItemCodec with encode and decode functions');
		}

		this.codec = codec;

		if (data instanceof Uint8Array) {
			this.insertDecoded(byteEnvelopeDecode(data, codec));
		}
	}

	/**
	 * Same as `RedBlackTree.filter()`, but the new tree keeps this tree's
	 * codec as well as its comparator and options.
	 */
	public filter(func: RedBlackTreeMethod<ItemT, boolean>, thisArg?: unknown): ByteRedBlackTree<ItemT> {
		const tree = new ByteRedBlackTree<ItemT>(this.codec, this.comparator, null, this.options());
		tree.insertSorted(this.filterValues(func, thisArg));

		return tree;
	}

	/**
	 * Envelope holding each item's bytes in sorted order, smallest first,
	 * matching `stringify()`.
	 */
	public toByteEnvelope(): ByteEnvelope {
		return ByteEnvelope.encode(this.values(), this.codec.encode);
	}

	/**
	 * Raw bytes of the whole tree: the serialized envelope from
	 * `toByteEnvelope()`. The constructor accepts these bytes.
	 */
	public toBytes(): Uint8Array {
		return this.toByteEnvelope().toBytes();
	}

	/**
	 * Insert items decoded from an envelope. Bytes from `toBytes()` arrive in
	 * sorted order and are linked straight into a balanced tree. Bytes from
	 * anywhere else are not trusted to be sorted: unless every neighboring
	 * pair is in order (strictly, when duplicates are not allowed), items are
	 * inserted one by one.
	 */
	private insertDecoded(items: ItemT[]): void {
		for (let i = 1; i < items.length; i++) {
			const order = this.comparator(items[i - 1], items[i]);

			if (order > 0 || (order === 0 && !this.allowDuplicates)) {
				this.insertArray(items);
				return;
			}
		}

		this.insertSorted(items);
	}
}
