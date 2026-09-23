# Byte Envelope Specification

Defines how a collection in this package is converted to and from bytes. The envelope is the container format shared by every ADT. It stores the byte form of each item and says nothing about what those bytes mean, because items are generic and only the caller knows their layout.

Status: version 1. Any change to the layout below requires a new version number.

## Goals

- One container format for every ADT, so each byte class only maintains its own item handling.
- Item encoding stays with the caller. The package never inspects, stringifies, or parses item contents.
- Random access to any item's bytes without scanning the payload.
- Malformed input is rejected before any item decoder runs.

## Non-goals

- Defining an item byte format. That is the caller's `ItemCodec`.
- Preserving ADT-specific structure beyond item order. A list, stack, or queue all serialize to the same shape: items in collection order. Rebuilding structure is the job of the byte class constructor.
- Compression, checksums, or encryption. Callers can wrap the envelope bytes.

## Layout

All multi-byte integers are unsigned little-endian.

| Offset   | Size  | Field       | Value                                             |
|----------|-------|-------------|---------------------------------------------------|
| 0        | 4     | magic       | ASCII `TADT` (`0x54 0x41 0x44 0x54`)              |
| 4        | 1     | version     | `1`                                               |
| 5        | 4     | count       | number of items, `n`                              |
| 9        | 8 × n | directory   | one entry per item, in collection order           |
| 9 + 8n   | var   | payload     | item bytes                                        |

Each directory entry:

| Offset within entry | Size | Field  | Value                                            |
|---------------------|------|--------|--------------------------------------------------|
| 0                   | 4    | offset | start of the item's bytes, relative to payload   |
| 4                   | 4    | length | number of bytes for the item                     |

Constants exposed by `ByteEnvelope`: `Magic`, `Version`, `HeaderSize` (9), `EntrySize` (8).

Properties that follow from the layout:

- An empty collection is exactly 9 bytes: magic, version, and a zero count.
- Zero-length items are valid. Their entry has whatever offset the writer chose and a length of 0.
- The writer lays items out contiguously in order, so offsets are cumulative. Readers must not assume this. Any entry whose range lies inside the payload is accepted, which leaves room for a future writer to share or reorder item bytes without a version change.
- Counts, offsets, and lengths are 32-bit, so an envelope holds at most 2^32 − 1 items and its payload is at most 4 GiB.

## Validation

`ByteEnvelope.fromBytes(bytes)` returns `null`, never throws, when any of these fail. Checks run in this order and stop at the first failure:

1. `bytes` is a `Uint8Array` of at least `HeaderSize` bytes.
2. The magic matches.
3. The version equals `ByteEnvelope.Version`.
4. `HeaderSize + count × EntrySize` does not exceed the byte length. This rejects a count that overruns the buffer before the directory is read.
5. For every entry, `payloadStart + offset + length` does not exceed the byte length.

Item bytes are copied out with `slice`, never aliased, so mutating the source buffer after parsing does not change the envelope. The parser reads through a `DataView` built from the array's own `byteOffset` and `byteLength`, so a view into a larger buffer parses correctly.

Item decoders are never called during validation. A caller's decoder only sees ranges that passed check 5.

## Classes and functions

All paths are under `src/`.

### `ByteEnvelope` — `byte/envelope.ts`

The container. Holds an ordered array of `Uint8Array` items.

| Member                          | Behavior                                                             |
|---------------------------------|----------------------------------------------------------------------|
| `new ByteEnvelope(items?)`      | Copies the array. Non-array input gives an empty envelope.           |
| `ByteEnvelope.encode(items, encode)` | Runs the encoder over each item, in order, into a new envelope. |
| `ByteEnvelope.fromBytes(bytes)` | Parses and validates per the rules above. `null` on failure.         |
| `items()`                       | Copy of the item array.                                              |
| `size()`                        | Item count.                                                          |
| `decode(decode)`                | Runs the decoder over each item, in order.                           |
| `toBytes()`                     | Serializes to the layout above.                                      |

### `ByteADT<ItemT>` — `byte/adt.ts`

Interface extending `ADT<ItemT>`. Implemented by every byte class. Both methods are non-null because a byte class always has a codec.

| Method               | Returns                                                  |
|----------------------|----------------------------------------------------------|
| `toByteEnvelope()`   | `ByteEnvelope` holding every item's bytes in collection order. |
| `toBytes()`          | `Uint8Array`, equal to `toByteEnvelope().toBytes()`.     |

The base `ADT` interface deliberately has no byte methods. Whether an instance can encode is decided at construction, so it is expressed by the type rather than by a runtime null or error code.

### `ItemCodec<ItemT>` — `item/codec.ts`

Caller-supplied pair `{encode, decode}`.

- `ItemEncoder<ItemT>` (`item/encoder.ts`): `(item: ItemT) => Uint8Array`.
- `ItemDecoder<ItemT>` (`item/decoder.ts`): `(bytes: Uint8Array) => ItemT`.
- `itemCodecValid(codec)` (`item/codec/valid.ts`): runtime guard that both members are functions. Byte class constructors use it to fail fast for callers outside the type system.

The package never calls a codec except through `ByteEnvelope.encode`, `ByteEnvelope.decode`, or `byteEnvelopeDecode`. A codec that throws propagates to the caller unchanged.

### `byteEnvelopeDecode(bytes, codec)` — `byte/envelope/decode.ts`

Shared constructor step for byte classes: parse with `fromBytes`, throw if `null`, otherwise decode every item. Exists so all byte classes reject malformed input with the same behavior.

### Byte classes

One per ADT, a superset of the base class. Naming and location: `Byte` prefix on the class, path `src/byte/<base path>`. Current implementations:

| Class            | Base         | Path                    |
|------------------|--------------|-------------------------|
| `ByteLinkedList` | `LinkedList` | `byte/linked/list.ts`   |

The remaining ADTs gain a byte class as each is reworked.

## Byte class contract

Constructor signature:

```
constructor(codec: ItemCodec<ItemT>, data?: ItemT[] | Uint8Array | null, options?: <BaseOptions> | null)
```

- `codec` is first and required. It is the only required argument. An invalid codec throws.
- `data` accepts everything the base constructor accepts plus envelope bytes. A `Uint8Array` is parsed with `byteEnvelopeDecode` after `super()` has run; malformed bytes throw. Any other input is ignored, matching the base class.
- `options` is always optional and never holds a required value. It is passed to the base constructor untouched.

Encoding rules:

- Items are encoded in collection order, as the base class's iteration would visit them (for `LinkedList`, head to tail).
- Elements whose stored value is `null` are skipped, matching `stringify()`. Decoding an envelope therefore never produces a null-valued element.
- `toBytes()` output round-trips: `new ByteX(codec, x.toBytes())` yields a collection with equal values in the same order, and its `toBytes()` is byte-for-byte equal.

Maintenance boundary: a byte class owns only its constructor, `toByteEnvelope()`, `toBytes()`, and any override needed so derived instances keep the codec (for example `filter()`). Everything else is inherited, so base class changes do not need mirroring.

## Error behavior summary

| Situation                                        | Behavior                          |
|--------------------------------------------------|-----------------------------------|
| `ByteEnvelope.fromBytes` given malformed bytes    | returns `null`                    |
| Byte class constructed without a valid codec      | throws                            |
| Byte class constructed with malformed bytes       | throws                            |
| Byte class constructed with non-array, non-byte data | ignored, empty collection      |
| Base class given a `Uint8Array`                   | ignored, empty collection         |
| Codec throws                                      | propagates                        |

Constructors throw rather than returning `null` because a constructor cannot return `null`, and silently producing an empty collection from corrupt bytes would hide data loss.

## Versioning

- The version byte identifies the layout, not the item format. Item format changes are the caller's concern.
- A reader accepts exactly one version. There is no negotiation or fallback.
- Additive changes that keep every field above at the same offset still require a new version, since readers reject unknown versions.
