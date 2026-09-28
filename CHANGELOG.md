# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0]

### New ADTs
* `BinarySearchTree`: binary search tree ordered by a required comparator, implementing `Tree`. Node wrappers are pooled by default.
    * `allowDuplicates` option, defaulting to `true`. When `false`, inserting a duplicate adds nothing and returns the `duplicate_not_allowed` error code instead of throwing.
    * `update()` sets a node's item, and moves the item when its position is no longer valid. Use it after changing an item in place.

### Breaking Changes

### Added
* `Tree` base interface shared by all tree ADTs, with `TreeElement` as the base node contract.

### Fixes
* `LinkedList` removes nodes in O(1) time instead of O(n), which occurred due an errant findIndex call, when it should have used the built-in `prev` and `next` references.
* `booleanValue` returns the provided boolean instead of always returning the fallback. Its type check used `Number.isFinite`, which rejects every boolean. This also fixes the `CircularQueue` `overwrite` option, which could never be enabled.

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