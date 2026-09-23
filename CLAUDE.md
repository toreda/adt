# Abstract Data Types (ADT)
Abstract Data Types are language-agnostic models of a data structure's behavior, interface, and performance, independent of implementation.

- Every collection in this package must follow its ADT contract.
- Minor deviations are allowed only where JavaScript makes the contract impossible or unreasonable. These should be rare and must not affect the public API.
- Major deviations (method names, return values) are violations unless justified in the function or class `@remarks`.
- Supersets are fine: extra features are allowed as long as the underlying contract still holds.

## Known Deviations
Several important ADT deviations:
* Collection methods should return `null` instead of throwing when empty or no matching element exists. The conventional behavior of throwing when `pop` is called on an empty collection doesn't work here.

## Binary Envelopes
Byte encoding is not part of the base `ADT` contract. Each ADT gets a `Byte*` superset subclass (e.g. `ByteLinkedList`) that requires an `ItemCodec` at construction and implements `ByteADT`. All byte classes share one container format, `ByteEnvelope`. The layout, validation rules, and byte class constructor contract are specified in `_specs/byte-envelope.md`; follow that spec when adding a byte class for another ADT.

## Data Structures

### Base Interfaces
* `Tree`: `<root>/src/tree.ts`
* `List`: `<root>/src/list.ts`
* `Graph`: `<root>/src/graph.ts`

### Implementations

**Trees**
* `BinaryTree`: `<root>/src/binary/tree.ts`
* `OctTree`: `<root>/src/oct/tree.ts`
* `QuadTree`: `<root>/src/quad/tree.ts`
* `RedBlackTree`: `<root>/src/red/black/tree.ts`

**Graphs**
* `DirectedGraph`: `<root>/src/directed/graph.ts`

**Lists**
* `LinkedList`: `<root>/src/linked/list.ts`
* `ByteLinkedList`: `<root>/src/byte/linked/list.ts` (superset of `LinkedList` implementing `ByteADT`)

**Standalone** (no shared base type)
* `CircularQueue`: `<root>/src/circular/queue.ts`
* `HashTable`: `<root>/src/hash/table.ts`
* `ObjectPool`: `<root>/src/object/pool.ts`
* `PriorityQueue`: `<root>/src/priority/queue.ts`
* `Queue`: `<root>/src/queue.ts`
* `Stack`: `<root>/src/stack.ts`
* `Trie`: `<root>/src/trie.ts`