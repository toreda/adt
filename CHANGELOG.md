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
* `RedBlackTree`: self-balancing binary search tree with O(log n) worst-case search, insert, and removal, implementing `Tree`. Same API and options as `BinarySearchTree`, plus node `color()` and `blackHeight()`.

### Breaking Changes
* Package renamed from `@toreda/adt` to `@toreda/data-structures`.
* `ADT` interface renamed to `DataStructure`, `ADTOptions` to `DataStructureOptions`, and `ByteADT` to `ByteDataStructure`.
* `CircularQueue` constructor is now `(data?, options?)`. Starting items are passed as an array in `data` instead of the `elements` option.
* `CircularQueue` options are reduced to `maxSize` and `overwrite`. The `elements`, `front`, `rear`, `size`, `serializedState`, and `reverseInsert` options are removed. Invalid option values fall back to their defaults instead of throwing.
* `CircularQueue` `forEach`, `filter`, and query result `index()` use positions from the front (0 is the front) instead of ring buffer slots. The `forEach` and `filter` callback receives the queue itself as its third argument instead of the ring buffer array, and `thisArg` is used as passed (`this` is undefined when omitted).
* `CircularQueue.getIndex()` returns `null` for positions outside the queue instead of wrapping around.
* `CircularQueue.stringify()` now returns `{"type":"CircularQueue","elements":[...]}` with items front to rear, or `null` when an item cannot be serialized.
* Removed `CircularQueue.state`, the `CircularQueueState` class, and the `toBinary()` stub. Use `ByteCircularQueue` for byte encoding.

### Added
* `Tree` base interface shared by all tree data structures, with `TreeElement` as the base node contract.
* `Graph` base interface shared by all graph data structures, with `GraphVertex` and `GraphEdge` as the base vertex and edge contracts.
* `ByteCircularQueue`: `CircularQueue` superset that requires an `ItemCodec` and converts to and from `ByteEnvelope` bytes.
* `CircularQueue.pushArray()` adds every item of an array, for arrays of any length, and `CircularQueue.values()` returns items front to rear.

### Fixes
* `LinkedList` removes nodes in O(1) time instead of O(n), which occurred due an errant findIndex call, when it should have used the built-in `prev` and `next` references.
* `booleanValue` returns the provided boolean instead of always returning the fallback. Its type check used `Number.isFinite`, which rejects every boolean. This also fixes the `CircularQueue` `overwrite` option, which could never be enabled.
* `intValue` and `intNullValue` return the provided integer instead of the fallback. Their check (`value % 1 !== 0`) accepted only non-integers. `intNullValue` also takes a `null` fallback, matching `numberNullValue`.
* `CircularQueue.pop()` releases its reference to the removed item, so popped items can be garbage collected.

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

[Unreleased]: https://github.com/toreda/adt/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/toreda/adt/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/toreda/adt/compare/v0.0.0...v0.1.0