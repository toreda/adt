# Byte Envelope Specification

Defines how a collection in this package is converted to and from bytes. The envelope is the container format shared by every data structure. It stores the byte form of each item and says nothing about what those bytes mean, because items are generic and only the caller knows their layout.

Status: envelope version 1, graph envelope version 1. Any change to either layout below requires a new version number for that layout.

## Goals

- One container format for the items of every data structure, so each byte class only maintains its own item handling. Graphs wrap that same envelope with their edges (see Graph envelope) rather than using a different item format.
- Item encoding stays with the caller. The package never inspects, stringifies, or parses item contents.
- Random access to any item's bytes without scanning the payload.
- Malformed input is rejected before any item decoder runs.

## Non-goals

- Defining an item byte format. That is the caller's `ItemCodec`.
- Preserving any structure beyond item order in the envelope itself. A list, stack, or queue all serialize to the same shape: items in collection order. Rebuilding structure is the job of the byte class constructor. Graphs, whose edges cannot be rebuilt from item order, use the separate graph envelope (see Graph envelope), which embeds an unchanged version 1 envelope.
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

Item bytes are copied out with `slice`, never aliased, so mutating the source buffer after parsing does not change the envelope. Each item is its own buffer starting at offset 0, so a decoder may read `bytes.buffer` directly. Handing decoders `subarray` views instead would save the copies but break both guarantees, so it is not done. The parser reads through a `DataView` built from the array's own `byteOffset` and `byteLength`, so a view into a larger buffer parses correctly.

Item decoders are never called during validation. A caller's decoder only sees ranges that passed check 5.

## Classes and functions

All paths are under `src/`.

### `ByteEnvelope` — `byte/envelope.ts`

The container. Holds an ordered array of `Uint8Array` items.

| Member                          | Behavior                                                             |
|---------------------------------|----------------------------------------------------------------------|
| `new ByteEnvelope(items?)`      | Copies the array (not the item arrays). Non-array input gives an empty envelope. |
| `ByteEnvelope.encode(items, encode)` | Runs the encoder over each item, in order, into a new envelope. The encoded array is built once and not copied again. |
| `ByteEnvelope.fromBytes(bytes)` | Parses and validates per the rules above. `null` on failure.         |
| `items()`                       | Copy of the item array.                                              |
| `size()`                        | Item count.                                                          |
| `decode(decode)`                | Runs the decoder over each item, in order.                           |
| `toBytes()`                     | Serializes to the layout above.                                      |

### `ByteDataStructure<ItemT>` — `byte/data/structure.ts`

Interface extending `DataStructure<ItemT>`. Implemented by every byte class. Both methods are non-null because a byte class always has a codec.

| Method               | Returns                                                  |
|----------------------|----------------------------------------------------------|
| `toByteEnvelope()`   | `ByteEnvelope` holding every item's bytes in collection order. |
| `toBytes()`          | `Uint8Array` accepted by the byte class constructor. Equal to `toByteEnvelope().toBytes()`, except for graphs, where it is the graph envelope (`toByteGraphEnvelope().toBytes()`). |

The base `DataStructure` interface deliberately has no byte methods. Whether an instance can encode is decided at construction, so it is expressed by the type rather than by a runtime null or error code.

### `ItemCodec<ItemT>` — `item/codec.ts`

Caller-supplied pair `{encode, decode}`.

- `ItemEncoder<ItemT>` (`item/encoder.ts`): `(item: ItemT) => Uint8Array`.
- `ItemDecoder<ItemT>` (`item/decoder.ts`): `(bytes: Uint8Array) => ItemT`.
- `itemCodecValid(codec)` (`item/codec/valid.ts`): runtime guard that both members are functions. Byte class constructors use it to fail fast for callers outside the type system.

The package never calls a codec except through `ByteEnvelope.encode`, `ByteEnvelope.decode`, or `byteEnvelopeDecode`. The encoder receives exactly one argument, the item, and the decoder exactly one, the item's bytes. A codec that throws propagates to the caller unchanged.

### `byteEnvelopeDecode(bytes, codec)` — `byte/envelope/decode.ts`

Shared constructor step for byte classes: parse with `fromBytes`, throw if `null`, otherwise decode every item. Exists so all byte classes reject malformed input with the same behavior.

### `ByteGraphEnvelope` — `byte/envelope/graph.ts`

The graph container, specified under Graph envelope. Holds a `ByteEnvelope` of vertex items and an ordered array of `ByteGraphEnvelopeEdge` records (`byte/envelope/edge.ts`: `{from, to, weight, bidirectional}`, vertices by index).

| Member                               | Behavior                                                        |
|--------------------------------------|-----------------------------------------------------------------|
| `new ByteGraphEnvelope(vertices?, edges?)` | Keeps the vertex envelope (anything else gives no vertices). Copies the edge array and each record (non-array gives no edges). Records are not validated. |
| `ByteGraphEnvelope.fromBytes(bytes)` | Parses and validates per the graph rules. `null` on failure.    |
| `vertices()`                         | The vertex `ByteEnvelope`.                                      |
| `edges()`                            | Copy of the edge records, in edge order.                        |
| `size()` / `edgeCount()`             | Vertex count / edge count.                                      |
| `toBytes()`                          | Serializes to the graph layout.                                 |

Constants: `Magic`, `Version`, `HeaderSize` (9), `EdgeCountSize` (4), `EdgeSize` (17), `FlagBidirectional` (1).

### Byte classes

One per data structure, a superset of the base class. Naming and location: `Byte` prefix on the class, path `src/byte/<base path>`. Current implementations:

| Class                  | Base               | Path                          |
|------------------------|--------------------|-------------------------------|
| `ByteLinkedList`       | `LinkedList`       | `byte/linked/list.ts`         |
| `ByteCircularQueue`    | `CircularQueue`    | `byte/circular/queue.ts`      |
| `ByteStack`            | `Stack`            | `byte/stack.ts`               |
| `ByteQueue`            | `Queue`            | `byte/queue.ts`               |
| `BytePriorityQueue`    | `PriorityQueue`    | `byte/priority/queue.ts`      |
| `ByteBinarySearchTree` | `BinarySearchTree` | `byte/binary/search/tree.ts`  |
| `ByteRedBlackTree`     | `RedBlackTree`     | `byte/red/black/tree.ts`      |
| `ByteQuadTree`         | `QuadTree`         | `byte/quad/tree.ts`           |
| `ByteOctTree`          | `OctTree`          | `byte/oct/tree.ts`            |
| `ByteTrie`             | `Trie`             | `byte/trie.ts`                |
| `ByteDirectedGraph`    | `DirectedGraph`    | `byte/directed/graph.ts`      |

`ObjectPool` has no byte class, by design. Its objects are pool-owned scratch instances that `cleanObj()` resets on release, not caller items, so there is no collection content to preserve. A pool is rebuilt by constructing it again with the same options.

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
- `ByteDirectedGraph` encodes vertices in insertion order and edges in edge insertion order, into a graph envelope (see Graph envelope). Its `data` bytes must be a graph envelope; a plain envelope throws like any other malformed input. `toByteEnvelope()` still returns the vertex items alone, as `ByteDataStructure` requires, and those bytes carry no edges.
- A byte class encodes exactly the items its `stringify()` includes. `LinkedList` skips elements whose stored value is `null`, so decoding its envelope never produces a null-valued element. `CircularQueue` stores items directly and encodes every item, passing any `null` item to the codec. The package-wide null rules are an open review item (`TODO.md`).
- `toBytes()` output round-trips: `new ByteX(codec, x.toBytes())` yields a collection with equal values in the same order, and its `toBytes()` is byte-for-byte equal.

Maintenance boundary: a byte class owns only its constructor, `toByteEnvelope()`, `toBytes()` (plus `toByteGraphEnvelope()` for graphs), and any override needed so derived instances keep the codec (for example `filter()`). Everything else is inherited, so base class changes do not need mirroring.

## Graph envelope

A graph's edges cannot be rebuilt from item order, so graphs use a second container that embeds a complete version 1 envelope for the vertex items and adds an edge section. A version 2 envelope with an optional structure section was rejected: a reader accepts exactly one version, so every existing byte class would have had to move to version 2 or split its reader by version. The graph envelope leaves every version 1 reader and writer unchanged, and its distinct magic means neither format is ever mistaken for the other.

All multi-byte integers are unsigned little-endian. Weights are IEEE 754 binary64, little-endian.

| Offset       | Size   | Field            | Value                                           |
|--------------|--------|------------------|-------------------------------------------------|
| 0            | 4      | magic            | ASCII `TADG` (`0x54 0x41 0x44 0x47`)            |
| 4            | 1      | version          | `1`                                             |
| 5            | 4      | envelope length  | byte length of the vertex envelope, `L`         |
| 9            | L      | vertex envelope  | a complete version 1 envelope: vertex items in vertex insertion order |
| 9 + L        | 4      | edge count       | number of edges, `m`                            |
| 13 + L       | 17 × m | edges            | one record per edge, in edge insertion order    |

Each edge record:

| Offset within record | Size | Field  | Value                                                 |
|----------------------|------|--------|-------------------------------------------------------|
| 0                    | 4    | from   | index of the edge's `from()` vertex in the envelope   |
| 4                    | 4    | to     | index of the edge's `to()` vertex                     |
| 8                    | 8    | weight | edge weight, f64                                      |
| 16                   | 1    | flags  | bit 0: bidirectional. Bits 1 to 7 must be 0.          |

Properties that follow from the layout:

- An empty graph is exactly 22 bytes: the 9-byte header, a 9-byte empty envelope, and a zero edge count.
- The edge section is the last thing in the buffer and its size is fixed by `m`, so the total length is exactly `13 + L + 17m`.
- Records are fixed size, so edge `i` starts at `13 + L + 17i` without scanning.
- A bidirectional edge is one record, holding `from()` and `to()` as added (`from()` is the first vertex passed to `addBidirectionalEdge`).
- Weights are f64, so every valid weight, including `-0`, round-trips exactly.

### Graph validation

`ByteGraphEnvelope.fromBytes(bytes)` returns `null`, never throws, when any of these fail. Checks run in this order and stop at the first failure. All of them run before any item decoder can.

1. `bytes` is a `Uint8Array` of at least `HeaderSize` (9) bytes.
2. The magic matches `TADG`.
3. The version equals `ByteGraphEnvelope.Version`.
4. `HeaderSize + L + EdgeCountSize` does not exceed the byte length.
5. Bytes `9` to `9 + L` are a valid version 1 envelope under every envelope rule above. They are parsed from a view bounded to exactly those `L` bytes, so a vertex entry can never reach into the edge section.
6. `13 + L + m × EdgeSize` equals the byte length exactly: no truncated record and no trailing bytes.
7. For every record, in order:
   1. `from` and `to` are less than the vertex count.
   2. `weight` is finite and not less than 0, the rule `DirectedGraph` applies when adding an edge (`-0` passes).
   3. No flag bit other than bit 0 is set.
   4. No direction of travel the record adds (`from` to `to`, plus `to` to `from` when bidirectional) is already covered by an earlier record. This is the graph's own rule of at most one edge per direction, so rebuilding never meets `edge_exists`.

Every record that passes can be added to the rebuilt graph, so `ByteDirectedGraph` either rebuilds every vertex and edge or throws before its decoder is called.

## Error behavior summary

| Situation                                        | Behavior                          |
|--------------------------------------------------|-----------------------------------|
| `ByteEnvelope.fromBytes` given malformed bytes    | returns `null`                    |
| `ByteGraphEnvelope.fromBytes` given malformed bytes, including malformed edge records | returns `null` |
| `ByteDirectedGraph` constructed with bytes that are not a valid graph envelope | throws, before any item is decoded |
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
- The envelope and the graph envelope are versioned independently. The graph envelope version names the whole graph layout, including the version of the embedded envelope: graph envelope version 1 embeds envelope version 1. A new envelope version therefore also needs a new graph envelope version before graphs embed it.
- Structure for another data structure, if ever needed, follows the graph pattern: a container with its own magic that embeds an unchanged envelope, not a change to the envelope itself.
