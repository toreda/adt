import {ByteEnvelope} from '../envelope.js';
import {type ItemCodec} from '../../item/codec.js';

/**
 * Rebuild items from envelope bytes received by a byte data structure constructor.
 * Shared by every byte data structure so they reject malformed input the same way.
 *
 * @throws		When `bytes` is not a well formed `ByteEnvelope`.
 *
 * @category Base
 */
export function byteEnvelopeDecode<ItemT>(bytes: Uint8Array, codec: ItemCodec<ItemT>): ItemT[] {
	const envelope = ByteEnvelope.fromBytes(bytes);

	if (envelope === null) {
		throw new Error('byte input is not a valid ByteEnvelope');
	}

	return envelope.decode(codec.decode);
}
