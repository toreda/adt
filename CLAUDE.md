# Abstract Data Types (ADT)
Abstract Data Types are language-agnostic models of a data structure's behavior, interface, and performance, independent of implementation.

- Every collection in this package must follow its ADT contract.
- Minor deviations are allowed only where JavaScript makes the contract impossible or unreasonable. These should be rare and must not affect the public API.
- Major deviations (method names, return values) are violations unless justified in the function or class `@remarks`.
- Supersets are fine: extra features are allowed as long as the underlying contract still holds.

## Known Deviations
Several important ADT deviations:
* Collection methods should return `null` instead of throwing when empty or no matching element exists. The conventional behavior of throwing when `pop` is called on an empty collection doesn't work here.

## Subclass vs. Option
When adding a capability to an ADT, decide how it is exposed by whether it changes the constructor contract:

- **Subclass** when the capability needs a required constructor argument or adds public methods. The requirement becomes a type-level fact, so callers can never hold an instance that lacks it (e.g. `ByteLinkedList` requires an `ItemCodec` and adds `toBytes()`).
- **Subclass** also when the capability places a correctness obligation on the caller that the ADT cannot verify. The ADT treats items as opaque, so it can never check that the caller held up their end, and misuse must not look like a free upgrade.
- **Option** when the capability has a sensible default, changes no public method or ADT contract, and cannot be misused destructively (e.g. a size limit, an overwrite flag, pooling of the ADT's own element wrappers).

Pooling illustrates the line. ADTs never allocate items; callers construct them and pass references in. The only allocation an ADT makes per insert is its own element wrapper (e.g. `LinkedListElement`), which it fully owns and can reset correctly, so wrapper pooling is an internal option. Pooling of caller items is not an ADT feature at all: callers who need it compose an `ObjectPool` of their item class alongside the collection.

Wrapper pooling is implemented once in `ElementPool` (`src/element/pool.ts`). A node-based ADT holds one per element type (`new ElementPool(ElementClass, options)`), calls `allocate()` / `release()` / `releaseAll()`, and returns `options()` when building derived instances. The element class implements `ObjectPoolInstance` and its `cleanObj()` must clear every field. Array-backed ADTs hold no `ElementPool`. `ADT` stays a plain interface; there is no abstract base class.
- `options` is always optional and therefore never holds a required value. A required value must be a positional constructor argument, which means a subclass.

## Binary Envelopes
Byte encoding is not part of the base `ADT` contract. Each ADT gets a `Byte*` superset subclass (e.g. `ByteLinkedList`) that requires an `ItemCodec` at construction and implements `ByteADT`. All byte classes share one container format, `ByteEnvelope`. The layout, validation rules, and byte class constructor contract are specified in `_specs/byte-envelope.md`; follow that spec when adding a byte class for another ADT.

## Data Structures

### Base Interfaces
* `Tree`: `<root>/src/tree.ts` (nodes implement `TreeElement`: `<root>/src/tree/element.ts`)
* `List`: `<root>/src/list.ts`
* `Graph`: `<root>/src/graph.ts`

### Implementations

**Trees**
* `BinaryTree`: `<root>/src/binary/tree.ts`
* `BinarySearchTree`: `<root>/src/binary/search/tree.ts`
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