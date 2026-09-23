import {ByteEnvelope} from '../envelope';
import {type ItemCodec} from '../../item/codec';

/**
 * Rebuild items from envelope bytes received by a byte ADT constructor.
 * Shared by every byte ADT so they reject malformed input the same way.
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
