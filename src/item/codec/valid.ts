import {type ItemCodec} from '../codec';

/**
 * Runtime check that a value is a usable `ItemCodec`: an object with both
 * `encode` and `decode` functions. Byte ADT constructors use it to fail fast
 * for callers outside the type system.
 *
 * @category Base
 */
export function itemCodecValid<ItemT>(codec: unknown): codec is ItemCodec<ItemT> {
	if (typeof codec !== 'object' || codec === null) {
		return false;
	}

	const candidate = codec as Partial<ItemCodec<ItemT>>;

	return typeof candidate.encode === 'function' && typeof candidate.decode === 'function';
}
