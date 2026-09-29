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
When adding a capability to a data structure, decide how it is exposed by whether it changes the constructor contract:

- **Subclass** when the capability needs a required constructor argument or adds public methods. The requirement becomes a type-level fact, so callers can never hold an instance that lacks it (e.g. `ByteLinkedList` requires an `ItemCodec` and adds `toBytes()`).
- **Subclass** also when the capability places a correctness obligation on the caller that the data structure cannot verify. The data structure treats items as opaque, so it can never check that the caller held up their end, and misuse must not look like a free upgrade.
- **Option** when the capability has a sensible default, changes no public method or ADT contract, and cannot be misused destructively (e.g. a size limit, an overwrite flag, pooling of the data structure's own element wrappers).

Pooling illustrates the line. Data structures never allocate items; callers construct them and pass references in. The only allocation a data structure makes per insert is its own element wrapper (e.g. `LinkedListElement`), which it fully owns and can reset correctly, so wrapper pooling is an internal option. Pooling of caller items is not a data structure feature at all: callers who need it compose an `ObjectPool` of their item class alongside the collection.

Wrapper pooling is implemented once in `ElementPool` (`src/element/pool.ts`). A node-based data structure holds one per element type (`new ElementPool(ElementClass, options)`), calls `allocate()` / `release()` / `releaseAll()`, and returns `options()` when building derived instances. The element class implements `ObjectPoolInstance` and its `cleanObj()` must clear every field. Array-backed data structures hold no `ElementPool`. `DataStructure` stays a plain interface; there is no abstract base class.
- `options` is always optional and therefore never holds a required value. A required value must be a positional constructor argument, which means a subclass.

## Binary Envelopes
Byte encoding is not part of the base `DataStructure` contract. Each data structure gets a `Byte*` superset subclass (e.g. `ByteLinkedList`) that requires an `ItemCodec` at construction and implements `ByteDataStructure`. All byte classes share one container format, `ByteEnvelope`, except `ByteDirectedGraph`, whose `ByteGraphEnvelope` embeds an unchanged `ByteEnvelope` of vertex items and adds an edge section. `ObjectPool` has no byte class, because its objects are pool-owned scratch instances, not caller items. The layouts, validation rules, and byte class constructor contract are specified in `_specs/byte-envelope.md`; follow that spec when adding a byte class for another data structure.

## Data Structures

### Base Interfaces
* `DataStructure`: `<root>/src/data/structure.ts` (options: `DataStructureOptions`, `<root>/src/data/structure/options.ts`)
* `ByteDataStructure`: `<root>/src/byte/data/structure.ts`
* `Tree`: `<root>/src/tree.ts` (nodes implement `TreeElement`: `<root>/src/tree/element.ts`)
* `List`: `<root>/src/list.ts`
* `Graph`: `<root>/src/graph.ts` (vertices implement `GraphVertex`: `<root>/src/graph/vertex.ts`; edges implement `GraphEdge`: `<root>/src/graph/edge.ts`)

### Implementations

**Trees**
* `BinarySearchTree`: `<root>/src/binary/search/tree.ts`
* `ByteBinarySearchTree`: `<root>/src/byte/binary/search/tree.ts` (superset of `BinarySearchTree` implementing `ByteDataStructure`)
* `OctTree`: `<root>/src/oct/tree.ts`
* `ByteOctTree`: `<root>/src/byte/oct/tree.ts` (superset of `OctTree` implementing `ByteDataStructure`)
* `QuadTree`: `<root>/src/quad/tree.ts`
* `ByteQuadTree`: `<root>/src/byte/quad/tree.ts` (superset of `QuadTree` implementing `ByteDataStructure`)
* `RedBlackTree`: `<root>/src/red/black/tree.ts`
* `ByteRedBlackTree`: `<root>/src/byte/red/black/tree.ts` (superset of `RedBlackTree` implementing `ByteDataStructure`)

**Graphs**
* `DirectedGraph`: `<root>/src/directed/graph.ts`
* `ByteDirectedGraph`: `<root>/src/byte/directed/graph.ts` (superset of `DirectedGraph` implementing `ByteDataStructure`)

**Lists**
* `LinkedList`: `<root>/src/linked/list.ts`
* `ByteLinkedList`: `<root>/src/byte/linked/list.ts` (superset of `LinkedList` implementing `ByteDataStructure`)

**Standalone** (no shared base type)
* `CircularQueue`: `<root>/src/circular/queue.ts`
* `ByteCircularQueue`: `<root>/src/byte/circular/queue.ts` (superset of `CircularQueue` implementing `ByteDataStructure`)
* `ObjectPool`: `<root>/src/object/pool.ts`
* `PriorityQueue`: `<root>/src/priority/queue.ts`
* `BytePriorityQueue`: `<root>/src/byte/priority/queue.ts` (superset of `PriorityQueue` implementing `ByteDataStructure`)
* `Queue`: `<root>/src/queue.ts`
* `ByteQueue`: `<root>/src/byte/queue.ts` (superset of `Queue` implementing `ByteDataStructure`)
* `Stack`: `<root>/src/stack.ts`
* `ByteStack`: `<root>/src/byte/stack.ts` (superset of `Stack` implementing `ByteDataStructure`)
* `Trie`: `<root>/src/trie.ts`
* `ByteTrie`: `<root>/src/byte/trie.ts` (superset of `Trie` implementing `ByteDataStructure`)


## Performance Rules

### Collection Allocations
* Collections that create a wrapper object for each stored item must use an internal `ObjectPool` to allocate wrapper instances.

### Class Members
* Call `.bind()` once per member function at most.
* Place all `.bind()` calls in a `private bindHandlers()` method called at the end of the ctor.
  * No `bindHandlers()` method is required for classes with no `.bind()` calls.  