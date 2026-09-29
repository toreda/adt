import {ByteEnvelope} from '../../src/byte/envelope';
import {ByteTrie} from '../../src/byte/trie';
import {type ItemCodec} from '../../src/item/codec';
import {Trie} from '../../src/trie';

interface Entry {
	k: string;
	v: number;
}

/** Codec for entries: the value as a float64, then the key's UTF-16 code units. */
const codec: ItemCodec<Entry> = {
	encode: (item) => {
		const bytes = new Uint8Array(8 + item.k.length * 2);
		const view = new DataView(bytes.buffer);
		view.setFloat64(0, item.v);

		for (let i = 0; i < item.k.length; i++) {
			view.setUint16(8 + i * 2, item.k.charCodeAt(i));
		}

		return bytes;
	},
	decode: (bytes) => {
		const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
		let k = '';

		for (let i = 8; i < bytes.byteLength; i += 2) {
			k += String.fromCharCode(view.getUint16(i));
		}

		return {v: view.getFloat64(0), k};
	}
};

const byK = (entry: Entry): string => entry.k;

const entries = (keys: string[]): Entry[] => keys.map((k, v) => ({k, v}));

/** Shape fingerprint: every node's path and whether it holds an item, in pre-order. */
const shape = (trie: Trie<Entry>): string[] => {
	const result: string[] = [];
	const stack: {node: ReturnType<Trie<Entry>['root']>; path: string}[] = [{node: trie.root(), path: ''}];

	while (stack.length) {
		const {node, path} = stack.pop()!;
		result.push(`${path}${node.isTerminal() ? '*' : ''}`);

		for (let i = node._children.length - 1; i >= 0; i--) {
			stack.push({node: node._children[i], path: path + String.fromCharCode(node._codes[i])});
		}
	}

	return result;
};

const words = ['she', 'sells', 'sea', 'shells', 'by', 'the', 'shore', '', 'shell', '😀'];

describe('ByteTrie', () => {
	describe('constructor', () => {
		it('is a Trie', () => {
			const result = new ByteTrie(codec, byK);

			expect(result).toBeInstanceOf(ByteTrie);
			expect(result).toBeInstanceOf(Trie);
			expect(result.size()).toBe(0);
			expect(result.codec).toBe(codec);
			expect(result.keySelector).toBe(byK);
		});

		it('with items', () => {
			const items = entries(words);
			const result = new ByteTrie(codec, byK, items);

			expect(result.size()).toBe(words.length);
			expect(result.values()).toEqual(new Trie(byK, items).values());
		});

		it('from envelope bytes, rebuilding the same shape', () => {
			const source = new ByteTrie(codec, byK, entries(words));
			const result = new ByteTrie(codec, byK, source.toBytes());

			expect(result.size()).toBe(words.length);
			expect(result.values()).toEqual(source.values());
			expect(shape(result)).toEqual(shape(source));
		});

		it('from empty envelope bytes', () => {
			const bytes = new ByteTrie(codec, byK).toBytes();

			expect(bytes.length).toBe(ByteEnvelope.HeaderSize);
			expect(new ByteTrie(codec, byK, bytes).size()).toBe(0);
			expect(new ByteTrie(codec, byK, bytes, null).size()).toBe(0);
		});

		it('passes options through', () => {
			const bytes = new ByteTrie(codec, byK, entries(['a'])).toBytes();
			const plain = new ByteTrie(codec, byK, bytes, {disableElementPooling: true});

			expect((plain as any).elements.objectPool).toBeNull();
			expect(plain.size()).toBe(1);
		});

		it('ignores invalid data instead of throwing', () => {
			expect(new ByteTrie(codec, byK, null).size()).toBe(0);
			expect(new ByteTrie(codec, byK, 'adsf' as any).size()).toBe(0);
			expect(new ByteTrie(codec, byK, {elements: []} as any).size()).toBe(0);
		});

		it('throws without a valid codec', () => {
			expect(() => new (ByteTrie as any)()).toThrow();
			expect(() => new (ByteTrie as any)(null, byK, [])).toThrow();
			expect(() => new (ByteTrie as any)({encode: codec.encode}, byK, [])).toThrow();
			expect(() => new (ByteTrie as any)({decode: codec.decode}, byK, [])).toThrow();
			expect(() => new ByteTrie(codec, byK, [])).not.toThrow();
		});

		it('throws without a key selector', () => {
			expect(() => new (ByteTrie as any)(codec)).toThrow();
			expect(() => new (ByteTrie as any)(codec, null, [])).toThrow();
		});

		it('throws on bytes that are not a valid envelope', () => {
			expect(() => new ByteTrie(codec, byK, new Uint8Array([1, 2, 3]))).toThrow();
		});
	});

	describe('toByteEnvelope', () => {
		it('encodes each item in key order', () => {
			const encode = jest.fn(codec.encode);
			const source = new ByteTrie<Entry>({encode, decode: codec.decode}, byK, entries(words));

			const envelope = source.toByteEnvelope();

			expect(envelope).toBeInstanceOf(ByteEnvelope);
			expect(encode).toHaveBeenCalledTimes(words.length);
			expect(envelope.decode(codec.decode)).toEqual(source.values());
			expect(envelope.decode(codec.decode).map((e) => e.k)).toEqual(words.slice().sort());
		});
	});

	describe('toBytes', () => {
		it('round-trips byte for byte', () => {
			const source = new ByteTrie(codec, byK, entries(words));
			source.remove('shell');
			source.insert({k: 'shell', v: 99});
			const bytes = source.toBytes();
			const copy = new ByteTrie(codec, byK, bytes);

			expect(copy.toBytes()).toEqual(bytes);
			expect(shape(copy)).toEqual(shape(source));
			expect(copy.get('shell')).toEqual({k: 'shell', v: 99});
		});

		it('does not depend on insertion order', () => {
			const forward = new ByteTrie(codec, byK, entries(words));
			const backward = new ByteTrie(codec, byK, entries(words).reverse());

			expect(backward.toBytes()).toEqual(forward.toBytes());
		});

		it('equals toByteEnvelope().toBytes()', () => {
			const source = new ByteTrie(codec, byK, entries(words));

			expect(source.toBytes()).toEqual(source.toByteEnvelope().toBytes());
		});
	});

	describe('filter', () => {
		it('keeps the codec, key selector, and options', () => {
			const source = new ByteTrie(codec, byK, entries(words), {disableElementPooling: true});
			const result = source.filter((elem) => elem.key()!.startsWith('sh'));

			expect(result).toBeInstanceOf(ByteTrie);
			expect(result.codec).toBe(codec);
			expect(result.keySelector).toBe(byK);
			expect((result as any).elements.objectPool).toBeNull();
			expect(result.keys()).toEqual(['she', 'shell', 'shells', 'shore']);
			expect(new ByteTrie(codec, byK, result.toBytes()).values()).toEqual(result.values());
		});
	});
});
