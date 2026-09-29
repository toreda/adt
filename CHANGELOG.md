# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0]

### New Data Structures
* `BinarySearchTree`: binary search tree ordered by a required comparator, implementing `Tree`. Node wrappers are pooled by default.
    * `allowDuplicates` option, defaulting to `true`. When `false`, inserting a duplicate adds nothing and returns the `duplicate_not_allowed` error code instead of throwing.
    * `update()` sets a node's item, and moves the item when its position is no longer valid. Use it after changing an item in place.
* `DirectedGraph`: graph of vertices joined by weighted edges, implementing `Graph`. Each edge is one-way or bidirectional, and both kinds can be mixed. Includes breadth-first and depth-first traversal, cycle detection that is correct for mixed edge kinds, and cheapest paths with A* search. Vertex and edge wrappers are pooled by default.
* `OctTree`: point octree over 3D positions read by a required locator, implementing `Tree`. Same API and options as `QuadTree`, with a z coordinate and eight octants per node.
* `QuadTree`: point quadtree over 2D positions read by a required locator, implementing `Tree`. Includes exact position lookup, rectangle and radius searches, and nearest neighbor search. Node wrappers are pooled by default.
    * `allowDuplicates` option, defaulting to `true`. When `false`, inserting at an occupied position adds nothing and returns the `duplicate_not_allowed` error code instead of throwing. Items without finite coordinates are refused with `invalid_position`.
    * `update()` sets a node's item and moves the node to the item's new position, keeping the same node. Use it after changing an item's position in place.
* `RedBlackTree`: self-balancing binary search tree with O(log n) worst-case search, insert, and removal, implementing `Tree`. Same API and options as `BinarySearchTree`, plus node `color()` and `blackHeight()`.

### Breaking Changes
* Package renamed from `@toreda/adt` to `@toreda/data-structures`.
* `@toreda/log` and `@toreda/shared-types` are no longer peer dependencies, so the package has no runtime or peer dependencies. `typeValue` is now provided by this package. Projects that used either package without listing it in their own `package.json` must add it.
* `ADT` interface renamed to `DataStructure`, `ADTOptions` to `DataStructureOptions`, and `ByteADT` to `ByteDataStructure`.
* `CircularQueue` constructor is now `(data?, options?)`. Starting items are passed as an array in `data` instead of the `elements` option.
* `CircularQueue` options are reduced to `maxSize` and `overwrite`. The `elements`, `front`, `rear`, `size`, `serializedState`, and `reverseInsert` options are removed. Invalid option values fall back to their defaults instead of throwing.
* `CircularQueue` `forEach`, `filter`, and query result `index()` use positions from the front (0 is the front) instead of ring buffer slots. The `forEach` and `filter` callback receives the queue itself as its third argument instead of the ring buffer array, and `thisArg` is used as passed (`this` is undefined when omitted).
* `CircularQueue.getIndex()` returns `null` for positions outside the queue instead of wrapping around.
* `CircularQueue.stringify()` now returns `{"type":"CircularQueue","elements":[...]}` with items front to rear, or `null` when an item cannot be serialized.
* Removed `CircularQueue.state`, the `CircularQueueState` class, and the `toBinary()` stub. Use `ByteCircularQueue` for byte encoding.
* Build output moved from `dist/` to `dist/cjs/` and `dist/esm/`, and `package.json` now declares `exports`. Deep imports such as `@toreda/data-structures/dist/...` are no longer allowed; import from the package root.
* `serializedState` is removed from `StackOptions`, `QueueOptions`, `PriorityQueueOptions`, and `ObjectPoolOptions`. Use the collection's `Byte*` subclass, or pass items through `elements`.
* `toBinary()` is removed from `Stack` and `PriorityQueue`. Use `ByteStack` and `BytePriorityQueue`.
* `CircularQueue.push(item)` and `insertFront(item)` take exactly one item. Use `pushArray()` or the new `insertFrontArray()` to add several.
* `Queue.pop()` returns the removed item, or `null` when empty, instead of the queue.
* `Queue` no longer exposes its `state`. `QueueState` now describes the `stringify()` JSON shape. `Queue.at()` returns `null` for non-integers and accepts negative positions, which count back from the rear.
* `Stack.state` is a getter returning a new snapshot on each read. Changing it no longer changes the stack.
* The third argument of the `forEach` and `filter` callbacks of `Stack`, `Queue`, and `PriorityQueue` is the collection itself instead of an array. Their callback types are `StackMethod`, `QueueMethod`, and `PriorityQueueMethod`.
* `PriorityQueue.stringify()` returns `string | null`. Items of equal priority no longer swap, so heap array order can differ from earlier versions. `null` items are passed to the comparator like any other item.
* `ObjectPool.release()` returns a `boolean` and ignores objects that are not in use in this pool, leaving them untouched. In-use objects are visited in slot order, not allocation order, and `forEach` walks from the last slot to the first. `ObjectPoolState` gains `usedCount` and `freeCount`, and `stringify()` no longer includes the `pool` and `used` arrays.
* `ObjectPool.reset()` reuses existing objects, shrinking or refilling the pool to `startSize`, instead of constructing new ones.
* A user-supplied `pool.maxSize` is now a hard cap on pooled nodes. Nodes created beyond it are left to the garbage collector when removed.
* With pooling disabled, a node removed from `LinkedList`, `BinarySearchTree`, `RedBlackTree`, `QuadTree`, `OctTree`, or `DirectedGraph` is blanked, so `value()` returns `null`.
* `BinarySearchTree.update()` and `RedBlackTree.update()` always return the node they were given, relinked in place, instead of a new node.
* Iterators return the same result object from every `next()` call. `for...of` and spread are unaffected.
* `Graph` requires `forEachNeighbor()`.
* `Queue` and `PriorityQueue` `forEach` and `filter` use `thisArg` as passed unless it is `undefined`. Before, any falsy `thisArg` was replaced with the collection.
* `new Queue({elements})` with a non-array `elements` gives an empty queue instead of throwing.
* `CircularQueue` allocates all `maxSize` slots at construction, so a very large `maxSize` costs its memory up front.
* `ObjectPool.forEach` passes `state.used` as its third argument; slots from `size()` on hold `null`.
* `ObjectPool` stores a hidden, non-enumerable symbol property on each object it constructs, to track its slot. Classes whose constructor freezes, seals, or prevents extensions on the instance cannot be pooled.
* `ElementPool.release()` blanks and drops an element the pool rejects (one created past `maxSize`, or already released) instead of pooling it.
* `DirectedGraphVertex` has new public scratch fields for traversals and searches: `_walkId`, `_searchId`, `_searchCost`, `_searchEstimate`, and `_searchVia`. They show up in deep-equality checks.
* `DirectedGraph.findPath()` calls the heuristic at most once per vertex per search, and returns `null` when called on the same graph from inside its own heuristic.

### Added
* Exported validation helpers `booleanValue`, `booleanNullValue`, `numberValue`, `numberNullValue`, and `typeValue` (with its `TypeValueTest` type), alongside the existing `intValue` and `intNullValue`.
* Dual CommonJS and ES module builds. `require` and `import` each load their own build with matching type declarations.
* `Tree` base interface shared by all tree data structures, with `TreeElement` as the base node contract.
* `Graph` base interface shared by all graph data structures, with `GraphVertex` and `GraphEdge` as the base vertex and edge contracts.
* `ByteCircularQueue`: `CircularQueue` superset that requires an `ItemCodec` and converts to and from `ByteEnvelope` bytes.
* `CircularQueue.pushArray()` adds every item of an array, for arrays of any length, and `CircularQueue.values()` returns items front to rear.
* `Byte*` subclass for every collection except `ObjectPool`: `ByteStack`, `ByteQueue`, `BytePriorityQueue`, `ByteBinarySearchTree`, `ByteRedBlackTree`, `ByteQuadTree`, `ByteOctTree`, and `ByteDirectedGraph`.
* `ByteGraphEnvelope`: container for `ByteDirectedGraph`. Embeds an unchanged `ByteEnvelope` of vertex items and adds an edge section, so every other byte class keeps the v1 format.
* `QuadTree` and `OctTree` `forEachWithinBounds()` and `forEachWithinRadius()` visit matches without allocating. They are safe under mutation, with the same rules as `forEach`: matches are collected before the callback first runs, and a match removed before it is reached is skipped. `withinBounds()` and `withinRadius()` accept an optional array to refill.
* `DirectedGraph.forEachNeighbor()` visits neighbors without allocating. `neighbors()`, `outEdges()`, and `inEdges()` accept an optional array to refill, and `findPath()` accepts an optional path to refill.
* `children()` on every tree element accepts an optional array to refill.
* `CircularQueue.insertFrontArray()`, `Queue.values()`, `Stack.values()`, and `PriorityQueue.values()`.
* Exported `QueueIterator` and `StackIterator`, and the callback types `QueueMethod`, `StackMethod`, `PriorityQueueMethod`, and `GraphNeighborMethod`.
* `ByteDirectedGraph.toByteGraphEnvelope()` returns the graph container. `ByteDirectedGraph.toBytes()` serializes that container, while `toByteEnvelope()` holds the vertex items only. `ByteGraphEnvelopeEdge` is the type of one decoded edge.
* `BinarySearchTree` and `RedBlackTree` `update()` keep the node's identity when an item moves, so query results that point at it can still `delete()` it.
* Protected `filterInto()` on `Stack`, `Queue`, and `PriorityQueue`, and a protected `comparator` on `PriorityQueue` (previously private), so subclasses can build derived instances. Byte classes use them.

### Fixes
* `LinkedList` removes nodes in O(1) time instead of O(n), which occurred due an errant findIndex call, when it should have used the built-in `prev` and `next` references.
* `booleanValue` returns the provided boolean instead of always returning the fallback. Its type check used `Number.isFinite`, which rejects every boolean. This also fixes the `CircularQueue` `overwrite` option, which could never be enabled.
* `intValue` and `intNullValue` return the provided integer instead of the fallback. Their check (`value % 1 !== 0`) accepted only non-integers. `intNullValue` also takes a `null` fallback, matching `numberNullValue`.
* `CircularQueue.pop()` releases its reference to the removed item, so popped items can be garbage collected.
* `ObjectPool` no longer hands the same object to two callers after a double release, no longer accepts objects from outside the pool, and `allocateMultiple()` no longer hangs when the pool is at `maxSize`.
* `ObjectPool` iteration walks the in-use objects instead of the free list, and `forEach` passes the in-use list instead of the free list as its third argument.
* `ObjectPool.reset()` no longer loses track of objects that callers still hold, which made releasing them later add foreign objects to the pool.
* `Queue.stringify()` returns `null` instead of throwing when an item cannot be serialized, as the `DataStructure` contract requires.
* `QuadTree` and `OctTree` `withinRadius()` docs no longer claim results come back in pre-order. The quadrant or octant holding the point is searched first.
* `QuadTree` and `OctTree` iterators stop when the next node has been removed, instead of yielding `null` or the removed item.
* With pooling disabled, removed nodes no longer keep their items alive.

### Performance
Steady-state hot paths no longer allocate. Each of these was measured with zero garbage collections over 2 million operations after warm-up:
* `ObjectPool` allocate and release.
* `CircularQueue`, `Queue`, `Stack`, and `PriorityQueue` push and pop.
* `LinkedList`, `BinarySearchTree`, `RedBlackTree`, and `QuadTree` insert and remove.
* `BinarySearchTree`, `RedBlackTree`, and `QuadTree` `update()` moves.
* `QuadTree` and `OctTree` `nearest()`, `forEachWithinBounds()`, and `forEachWithinRadius()`.
* `DirectedGraph.findPath()` with a reused path, and `forEachNeighbor()`.
* `forEach` on every collection.

Adding and removing `DirectedGraph` edges and vertices still produces some garbage, about one full GC per 50,000 edge changes, because V8 reallocates `Map` tables as entries are added and removed.

Changes by data structure:
* **`ObjectPool`**
    * `release()` swap-removes the object from the in-use list. It used to rebuild that list with `Array.filter()` and rebuild an index `Map` once half its slots were empty, which happened on almost every release in an allocate/release loop.
    * `forEach`, `clearElements()`, and `releaseMultiple()` walk the in-use list directly instead of copying it first.
    * The `autoIncrease` growth check no longer boxes a fractional number on every `allocate()`. This check runs for every pooled node insert in the node-based collections.
    * `query()` stops once it reaches `limit`.
* **`CircularQueue`**
    * `push()` and `insertFront()` no longer build an argument array on each call.
    * The ring buffer is allocated once at construction and kept by `clearElements()` and `reset()`.
    * Slot lookups use one conditional add or subtract instead of two `%` operations.
* **`Queue`** is a growable ring buffer, so `pop()` is O(1) instead of O(n) `Array.shift()`.
* **`Stack` and `PriorityQueue`** keep their backing arrays at the largest size reached. V8 shrinks an array's storage on `pop()` and `length = 0`, so fill and drain cycles used to reallocate it. `Stack.forEach` no longer copies and reverses the stack.
* **`PriorityQueue`**
    * Sift steps compute child indexes inline instead of allocating `{left, right}` objects.
    * Items of equal priority no longer swap, so a heap with duplicates skips a full re-heapify.
* **`LinkedList`, `BinarySearchTree`, `RedBlackTree`**
    * `clearElements()` releases nodes while walking the links, instead of building an array first.
    * `height()` walks parent links without a stack.
    * The in-order traversals build a single array.
    * The balanced build behind `filter()` is iterative.
    * `update()` relinks the same node without going through the node pool.
* **`QuadTree` and `OctTree`**
    * Removing or moving a leaf relinks nothing.
    * Removing an inner node relinks its subtree in one pass, without temporary arrays or O(k) `shift()` calls.
    * `nearest()` and the radius and bounds searches use reusable scratch stacks instead of per-call arrays and closures.
    * `forEach` snapshots into reused scratch arrays.
    * `height()` walks without a stack.
    * With `allowDuplicates: false`, inserts check for a duplicate during the same descent that finds the slot.
* **`DirectedGraph`**
    * `removeVertex()` builds no temporary `Set` or array.
    * `findPath()` keeps one search state per graph, with a reused open set, pooled queue entries, and per-vertex scratch fields. It follows edges without entry arrays and runs the heuristic once per vertex per search.
    * `breadthFirst()` and `depthFirst()` mark visited vertices in place instead of using a `Set`, and reuse their stacks.
    * `hasCycle()` uses union by size.
* **`RedBlackTree`** `update()` finds the item's predecessor and successor once instead of twice.
* **`LinkedList`** `values()` and `removeNodes()` walk without closures.
* **`DirectedGraph`** `forEach()` and `find()` create no iterator, `clearElements()` walks its sets directly, and a removed vertex's edge maps are cleared once instead of twice.
* **`ByteEnvelope`** `encode()` and `fromBytes()` no longer copy their item arrays a second time.
* **All collections**
    * `Queue`, `PriorityQueue`, and `ObjectPool` `query()` stop walking once they reach `limit`.
    * Iterators reuse one result object.
    * `query()` checks filters in a plain loop, with no closure per visited item.
    * Arrays passed in to be refilled are overwritten by index, so their storage is reused.

## [0.1.0]

### Added
-   Initial early release. Project API is not stable until v1.0.0+

-   Added Queue ADT
-   Added Stack ADT
-   Added Linked List ADT
-   Added Priority Queue ADT
-   Added Circular Queue ADT
-   Added Object Pool ADT
-   Added Serialization
-   Added Query Selector

[Unreleased]: https://github.com/toreda/data-structures/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/toreda/data-structures/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/toreda/data-structures/compare/v0.0.0...v0.1.0