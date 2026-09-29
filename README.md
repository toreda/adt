[![Toreda](https://content.toreda.com/logo/toreda-logo.png)](https://www.toreda.com)

[![CI](https://img.shields.io/github/actions/workflow/status/toreda/data-structures/main.yml?branch=master&style=for-the-badge)](https://github.com/toreda/data-structures/actions) [![GitHub package.json version (branch)](https://img.shields.io/github/package-json/v/toreda/data-structures/master?style=for-the-badge)](https://github.com/toreda/data-structures/releases/latest) [![GitHub Release Date](https://img.shields.io/github/release-date/toreda/data-structures?style=for-the-badge)](https://github.com/toreda/data-structures/releases/latest) [![GitHub issues](https://img.shields.io/github/issues/toreda/data-structures?style=for-the-badge)](https://github.com/toreda/data-structures/issues)

[![GitHub](https://img.shields.io/github/stars/toreda/data-structures?style=for-the-badge&logo=github&label=GitHub)](https://github.com/toreda/data-structures) [![NPM Downloads](https://img.shields.io/npm/dm/@toreda/data-structures?style=for-the-badge&logo=npm&label=NPM)](https://www.npmjs.com/package/@toreda/data-structures) [![license](https://img.shields.io/github/license/toreda/data-structures?style=for-the-badge)](https://github.com/toreda/data-structures/blob/master/LICENSE.md)

# `@toreda/data-structures` <!-- omit from toc -->

Generic TypeScript data structures built for low garbage collection (GC) churn. Made for games, real-time audio and video, and other hot loops where GC pauses cause dropped frames and audio glitches.

* **Pooled nodes by default.** `LinkedList`, `BinarySearchTree`, `RedBlackTree`, `QuadTree`, `OctTree`, `SpatialHash`, `SpatialMap`, and `DirectedGraph` recycle their internal node wrappers. Once a pool has grown, inserts and removals in steady state create no new nodes.
* **Fixed-capacity ring buffer.** `CircularQueue` pushes and pops in O(1) without resizing, which suits audio samples, network packets, input history, and frame timings.
* **Pools for your own objects.** `ObjectPool` hands out reusable instances of your own classes, such as particles, entities, and projectiles, instead of allocating new ones each frame.
* **Game-ready algorithms.** `QuadTree` and `OctTree` handle 2D and 3D range, radius, and nearest neighbor queries for collision and visibility. `SpatialHash` and `SpatialMap` are uniform grids for items that move every frame and for voxel and tile worlds. `DirectedGraph` finds A* paths, and `PriorityQueue` schedules by priority.
* **Stack-safe.** Tree and graph traversals are iterative, so deep or lopsided structures never overflow the call stack.
* **One consistent API.** Every collection supports search, insertion, deletion, `query()` filters, and JSON serialization, and returns `null` instead of throwing when empty.
* **Binary encoding.** Every collection except `ObjectPool` has a `Byte*` subclass, such as `ByteLinkedList` or `ByteDirectedGraph`, that encodes the whole collection to bytes with your own item codec and rebuilds it from those bytes.
* **Zero dependencies.** No runtime or peer dependencies. TypeScript types, an ES module build, and a CommonJS build are included.

# Contents <!-- omit from toc -->
- [Install](#install)
- [Use Cases](#use-cases)
	- [Game object pooling with `ObjectPool`](#game-object-pooling-with-objectpool)
	- [Bounded history and stream buffers with `CircularQueue`](#bounded-history-and-stream-buffers-with-circularqueue)
	- [Spatial queries with `QuadTree` and `OctTree`](#spatial-queries-with-quadtree-and-octtree)
	- [Moving items and voxel grids with `SpatialHash` and `SpatialMap`](#moving-items-and-voxel-grids-with-spatialhash-and-spatialmap)
	- [Pathfinding with `DirectedGraph`](#pathfinding-with-directedgraph)
	- [Ordered and scheduled data](#ordered-and-scheduled-data)
- [Performance](#performance)
	- [Runtime complexity](#runtime-complexity)
	- [Allocation benchmark](#allocation-benchmark)
	- [Compared with other packages](#compared-with-other-packages)
	- [When to use something else](#when-to-use-something-else)
- [**`DataStructure` Interface**](#datastructure-interface)
- [Data Structures](#data-structures)
	- [**`BinarySearchTree<T>`**](#binarysearchtreet)
		- [Basics](#basics)
		- [Traversal and iteration](#traversal-and-iteration)
		- [Objects ordered by key](#objects-ordered-by-key)
		- [Updating items after insertion](#updating-items-after-insertion)
		- [Duplicates](#duplicates)
		- [Filter, query, and serialize](#filter-query-and-serialize)
		- [Node pooling](#node-pooling)
	- [**`CircularQueue<T>`**](#circularqueuet)
		- [Circular queue basics](#circular-queue-basics)
		- [Use as a queue](#use-as-a-queue)
		- [Use as a buffer](#use-as-a-buffer)
		- [Iterating a circular queue](#iterating-a-circular-queue)
		- [Serialize a circular queue](#serialize-a-circular-queue)
	- [**`DirectedGraph<T>`**](#directedgrapht)
		- [Graph basics](#graph-basics)
		- [Edge errors](#edge-errors)
		- [Traversal and removal](#traversal-and-removal)
		- [Cheapest paths with A\*](#cheapest-paths-with-a)
		- [Cycle detection](#cycle-detection)
		- [Filter, query, and serialize a graph](#filter-query-and-serialize-a-graph)
		- [Vertex and edge pooling](#vertex-and-edge-pooling)
	- [`LinkedList<T>`](#linkedlistt)
		- [Linked list basics](#linked-list-basics)
		- [Walking nodes](#walking-nodes)
		- [Iterating a linked list](#iterating-a-linked-list)
		- [Remove, filter, and reverse](#remove-filter-and-reverse)
		- [Serialize a linked list](#serialize-a-linked-list)
		- [Linked list node pooling](#linked-list-node-pooling)
	- [**`ObjectPool<T>`**](#objectpoolt)
		- [Defining a pooled class](#defining-a-pooled-class)
		- [Allocating objects](#allocating-objects)
		- [Pool capacity and utilization](#pool-capacity-and-utilization)
		- [Iterating allocated objects](#iterating-allocated-objects)
		- [Releasing and resetting](#releasing-and-resetting)
		- [Serialize an object pool](#serialize-an-object-pool)
	- [**`OctTree<T>`**](#octtreet)
		- [Octree basics](#octree-basics)
		- [Octree spatial search](#octree-spatial-search)
	- [**`PriorityQueue<T>`**](#priorityqueuet)
		- [Priority queue basics](#priority-queue-basics)
		- [Iterating a priority queue](#iterating-a-priority-queue)
		- [Pop and reset a priority queue](#pop-and-reset-a-priority-queue)
		- [Serialize a priority queue](#serialize-a-priority-queue)
	- [**`QuadTree<T>`**](#quadtreet)
		- [Quadtree basics](#quadtree-basics)
		- [Quadtree spatial search](#quadtree-spatial-search)
		- [Moving and removing quadtree items](#moving-and-removing-quadtree-items)
		- [Quadtree traversal and shared features](#quadtree-traversal-and-shared-features)
	- [`Queue<T>`](#queuet)
		- [Queue basics](#queue-basics)
		- [Iterating a queue](#iterating-a-queue)
		- [Pop and reverse a queue](#pop-and-reverse-a-queue)
		- [Serialize and reset a queue](#serialize-and-reset-a-queue)
	- [**`RedBlackTree<T>`**](#redblacktreet)
		- [Balancing sorted input](#balancing-sorted-input)
		- [Node colors and black height](#node-colors-and-black-height)
		- [Red-black tree duplicates](#red-black-tree-duplicates)
	- [**`SpatialHash<T>`**](#spatialhasht)
		- [Spatial hash basics](#spatial-hash-basics)
		- [Moving spatial hash items](#moving-spatial-hash-items)
		- [Choosing a cell size](#choosing-a-cell-size)
	- [**`SpatialMap<T>`**](#spatialmapt)
		- [Spatial map basics](#spatial-map-basics)
		- [Collisions and overwrite](#collisions-and-overwrite)
	- [`Stack<T>`](#stackt)
		- [Stack basics](#stack-basics)
		- [Iterating a stack](#iterating-a-stack)
		- [Pop and reverse a stack](#pop-and-reverse-a-stack)
		- [Serialize and reset a stack](#serialize-and-reset-a-stack)
	- [**`Trie<T>`**](#triet)
		- [Trie basics](#trie-basics)
		- [Prefix search and autocomplete](#prefix-search-and-autocomplete)
		- [Objects keyed by string](#objects-keyed-by-string)
		- [Trie traversal and shared features](#trie-traversal-and-shared-features)
- [Query Selectors](#query-selectors)
- [Validation Helpers](#validation-helpers)
- [Development](#development)
- [License](#license)

# Install

```bash
npm install @toreda/data-structures
```

Or with another package manager:

```bash
pnpm add @toreda/data-structures
yarn add @toreda/data-structures
bun add @toreda/data-structures
```

* **No dependencies.** Installing adds this package only.
* **TypeScript types included.** No `@types` package is needed.
* **ES modules and CommonJS.** `import` and `require` each load their own build, with matching type declarations.
* **Browsers and Node.js.** The build targets ES2015 and uses no Node.js APIs, so it runs in browsers through any bundler, such as Vite, webpack, esbuild, or Rollup. Node.js 22 or later is supported and tested.
* **Tree-shakable.** The package declares `"sideEffects": false`, so bundlers leave out the data structures you don't import.

```typescript
// ES modules and TypeScript
import {CircularQueue, ObjectPool, QuadTree} from '@toreda/data-structures';
```

```javascript
// CommonJS
const {CircularQueue, ObjectPool, QuadTree} = require('@toreda/data-structures');
```

Import from the package root. Deep imports such as `@toreda/data-structures/dist/...` are blocked by the package's `exports` map.

# Use Cases

A game loop running at 60 FPS has 16.7 ms per frame. Code that allocates objects every frame, such as bullets, particles, temporary list nodes, or event records, keeps filling the heap, and the garbage collector then runs at unpredictable moments. Those pauses show up as stutter, dropped frames, and audio crackle in three.js, pixi.js, Babylon.js, Phaser, WebGL, WebGPU, and Web Audio apps. The fix is to allocate up front and reuse. The structures below are built around that.

## Game object pooling with `ObjectPool`

Use for bullets, particles, enemies, pickups, floating damage numbers, pooled three.js `Mesh` and `Object3D` wrappers, pixi.js `Sprite` and `Container` wrappers, and Web Audio voices.

* `allocate()` and `release()` are O(1) and allocate nothing. Each in-use object remembers its slot, and a release moves the last in-use object into the freed slot, so it never searches or compacts.
* Releasing an object twice, or one this pool never handed out, is ignored and `release()` returns `false`. Two callers can never be handed the same object.
* `startSize` creates every object during loading. `autoIncrease` is off by default, so the pool never grows mid-frame.
* When the pool is exhausted, `allocate()` returns `null` instead of throwing or allocating. You choose to skip the spawn, and memory stays bounded by `maxSize`.
* To grow instead, turn on `autoIncrease`. The pool then grows by `increaseFactor` once use passes `increaseBreakPoint`.
* `release()` calls your `cleanObj()`, so a reused object never carries state from its last use.

```typescript
import {ObjectPool, type ObjectPoolInstance} from '@toreda/data-structures';
import {Container, Sprite, Texture} from 'pixi.js';

const stage = new Container();

class Bullet implements ObjectPoolInstance {
	public readonly sprite = new Sprite(Texture.WHITE);
	public vx = 0;
	public vy = 0;

	constructor() {
		stage.addChild(this.sprite);
		this.cleanObj();
	}

	cleanObj(): void {
		this.vx = 0;
		this.vy = 0;
		this.sprite.visible = false;
	}
}

// All 512 bullets and sprites are created here, during loading
const bullets = new ObjectPool<Bullet>(Bullet, {startSize: 512, maxSize: 512});
const active: Bullet[] = [];

function fire(x: number, y: number, vx: number, vy: number): void {
	const bullet = bullets.allocate();
	if (bullet === null) {
		return; // Every bullet is in flight. Skip the shot instead of allocating.
	}

	bullet.sprite.position.set(x, y);
	bullet.sprite.visible = true;
	bullet.vx = vx;
	bullet.vy = vy;
	active.push(bullet);
}

function update(dt: number): void {
	for (let i = active.length - 1; i >= 0; i--) {
		const bullet = active[i];
		bullet.sprite.x += bullet.vx * dt;
		bullet.sprite.y += bullet.vy * dt;

		if (bullet.sprite.x < 0 || bullet.sprite.x > 1920) {
			// Swap with the last entry and pop, so removal never shifts the array
			active[i] = active[active.length - 1];
			active.pop();
			bullets.release(bullet);
		}
	}
}
```

## Bounded history and stream buffers with `CircularQueue`

Use for frame time averages and FPS meters, input history for replays and rollback netcode, the last N network snapshots for interpolation, sliding window averages, recent log lines, and chunk queues between a producer and a consumer.

* Capacity is fixed at construction, and all `maxSize` slots are allocated then. `push()`, `pop()`, `clearElements()`, and `reset()` reuse those slots and allocate nothing.
* `pop()` is O(1) and moves nothing, unlike `Array.prototype.shift()`, which is O(n).
* With `overwrite: true`, pushing to a full queue replaces the oldest item, so it always holds the latest `maxSize` items and memory never grows.
* `getIndex()` reads any position without removing it, and negative positions count back from the newest item.

```typescript
import {CircularQueue} from '@toreda/data-structures';

// Average of the last 120 frame times
const frameTimes = new CircularQueue<number>([], {maxSize: 120, overwrite: true});

let total = 0;

// Keeps a running sum, so each frame does O(1) work and allocates nothing
function onFrame(deltaMs: number): number {
	if (frameTimes.isFull()) {
		total -= frameTimes.front()!; // oldest time, about to be overwritten
	}

	frameTimes.push(deltaMs);
	total += deltaMs;

	return 1000 / (total / frameTimes.size());
}
```

## Spatial queries with `QuadTree` and `OctTree`

Use for finding the nearest enemy or target, everything within an attack or sound radius, click and hover picking, culling map markers, tiles, and props against the viewport, and 3D point clouds or light probes.

* `withinBounds()`, `withinRadius()`, and `nearest()` skip every quadrant or octant that cannot hold a match.
* `nearest()`, `forEachWithinBounds()`, and `forEachWithinRadius()` allocate nothing, so they are safe to call per entity per frame.
* Positions come from your own locator function, so items stay your own objects. Any finite position fits, with no world bounds to set up front.
* Nodes are pooled, every walk is iterative, and removing or moving an item allocates nothing.
* These are point trees. Moving a leaf with `update()` relinks nothing, but moving an inner node relinks its subtree, so they suit items that are static or move occasionally. For thousands of items that all move every frame, use `SpatialHash`.

## Moving items and voxel grids with `SpatialHash` and `SpatialMap`

Use for crowds, projectiles, and particles that all move every frame, broad-phase collision, proximity and awareness checks, and block, voxel, tile, and chunk worlds.

* Both cut space into cubic cells of one size and keep only occupied cells in a hash table, so space is unbounded and empty regions cost nothing.
* `update()` is O(1) on average however far an item moves. An item moving inside its cell only has its position written.
* `SpatialHash` holds any number of items per cell. `SpatialMap` holds at most one, refuses a second with `cell_occupied` (or replaces the first with `overwrite: true`), and finds a cell's item by integer cell coordinates with `findCell()`.
* `nearest()`, `forEachWithinBounds()`, `forEachWithinRadius()`, `update()`, and `findCell()` allocate nothing, and element wrappers are pooled.
* Searches only probe cells overlapping the search region, so pick a cell size near your typical search radius. See [Choosing a cell size](#choosing-a-cell-size).

## Pathfinding with `DirectedGraph`

Use for navigation graphs, waypoint networks, tile and hex maps, and dialogue and quest graphs.

* `findPath()` runs A* with your heuristic, or Dijkstra's algorithm without one, and returns the vertices, edges, and total cost.
* One-way and bidirectional edges mix freely in one graph, which covers one-way doors, ledges, and conveyors.
* Adjacency checks and edge insertion and removal are O(1), and vertex and edge wrappers are pooled. Adjacency lives in JavaScript `Map`s, which V8 resizes as entries are added and removed, so changing edges still produces some garbage: in our measurements on Node 23, about one major GC per 200,000 to 400,000 edge changes and no minor GCs. Build the graph up front, and keep per-frame work to lookups, `forEachNeighbor()`, and `findPath()`.
* `forEachNeighbor()` visits a vertex's neighbors without allocating, for per-frame AI and steering queries.
* `findPath()` reuses one search state per graph, and can refill a path object you pass in instead of returning a new one.

## Ordered and scheduled data

* **`RedBlackTree`** keeps items sorted with O(log n) worst case insert, find, and removal. Use it for leaderboards, timelines, sequencer events sorted by time, and sorted render or update queues. `update()` moves an item after its sort key changes and keeps the same node, and nodes are pooled.
* **`PriorityQueue`** is a binary heap for timers, scheduled events, AI task queues, and the open set in custom searches.
* **`LinkedList`** removes a node in O(1) when you hold the node. Use it for active lists where entities are removed in any order, and for LRU caches. Nodes are pooled, and `forEach` walks the links without building an array.

# Performance

## Runtime complexity

Time complexity of each operation, taken from the implementation. Variables:

* **n**: items in the structure. **k**: results returned.
* **h**: tree height. `BinarySearchTree`, `QuadTree`, and `OctTree` don't rebalance, so h is O(log n) for well-spread input and O(n) for sorted input or many duplicates.
* **V**, **E**: graph vertices and edges. **d**: a vertex's in-degree plus out-degree.
* **s**: items in one cell of a `SpatialHash`. **c**: cells a `SpatialHash` or `SpatialMap` search probes, which is the cells overlapping the search region, capped at the cell table size.
* **m**: key length in UTF-16 code units. **p**: prefix length. **t**: length of the text passed to `longestPrefixOf()`. **L**: longest stored key. **σ**: children of one trie node (binary searched). **S**: trie nodes under a prefix. **N**: trie nodes in total.

`query()` searches every structure the same way: a linear walk that tests each element against the filters. It doesn't use a tree's order or spatial layout, so prefer the structure's own lookups when they fit. It is still the only way to search by an arbitrary condition, or to find and remove items in structures with no lookup method (`Queue`, `Stack`, `PriorityQueue`, `LinkedList`, `CircularQueue`, `ObjectPool`). With the `limit` option the walk stops once `limit` results are found, which gives the best case below. A result's `delete()` removes the matched element.

Growing an internal array or element pool is left out of these costs. Growth doubles capacity, so it is amortized O(1) per insert, and the single insert that triggers it pays an extra O(n). `DirectedGraph` adjacency lives in `Map`s, so its costs assume normal hashing.

| Data structure | Action | Worst Case | Average Case | Best Case |
|---|---|---|---|---|
| `BinarySearchTree` | `insert` | O(n) | O(log n) | O(1) |
| `BinarySearchTree` | `find`, `contains` | O(n) | O(log n) | O(1) |
| `BinarySearchTree` | `remove` | O(n) | O(log n) | O(1) |
| `BinarySearchTree` | `removeNode` | O(n) | O(log n) | O(1) |
| `BinarySearchTree` | `update` | O(n) | O(log n) | O(h) |
| `BinarySearchTree` | `min`, `max` | O(n) | O(log n) | O(1) |
| `BinarySearchTree` | `successor`, `predecessor` | O(n) | O(log n) | O(1) |
| `BinarySearchTree` | `query` | O(n) | O(n) | O(h) |
| `BinarySearchTree` | `query` result `delete()` | O(n) | O(log n) | O(1) |
| `CircularQueue` | `push`, `insertFront` | O(1) | O(1) | O(1) |
| `CircularQueue` | `pop` | O(1) | O(1) | O(1) |
| `CircularQueue` | `front`, `rear`, `getIndex` | O(1) | O(1) | O(1) |
| `CircularQueue` | `query` | O(n) | O(n) | O(1) |
| `CircularQueue` | `query` result `delete()` | O(n) | O(n) | O(n) |
| `DirectedGraph` | `addVertex` | O(1) | O(1) | O(1) |
| `DirectedGraph` | `removeVertex` | O(d) | O(d) | O(1) |
| `DirectedGraph` | `addEdge`, `addBidirectionalEdge` | O(1) | O(1) | O(1) |
| `DirectedGraph` | `removeEdge` | O(1) | O(1) | O(1) |
| `DirectedGraph` | `edge`, `adjacent` | O(1) | O(1) | O(1) |
| `DirectedGraph` | `find`, `contains` | O(V) | O(V) | O(V) |
| `DirectedGraph` | `forEachNeighbor` | O(d) | O(d) | O(1) |
| `DirectedGraph` | `breadthFirst`, `depthFirst` | O(V + E) | O(V + E) | O(1) |
| `DirectedGraph` | `findPath` (A*) | O((V + E) log V) | O((V + E) log V) | O(1) |
| `DirectedGraph` | `hasCycle` | O(E α(V)) | O(E α(V)) | O(1) |
| `DirectedGraph` | `query` | O(V) | O(V) | O(1) |
| `DirectedGraph` | `query` result `delete()` | O(d) | O(d) | O(1) |
| `LinkedList` | `insert`, `insertAtHead`, `insertAtTail` | O(1) | O(1) | O(1) |
| `LinkedList` | `removeNode` | O(1) | O(1) | O(1) |
| `LinkedList` | `head`, `tail` | O(1) | O(1) | O(1) |
| `LinkedList` | `reverse` | O(n) | O(n) | O(n) |
| `LinkedList` | `query` | O(n) | O(n) | O(1) |
| `LinkedList` | `query` result `delete()` | O(1) | O(1) | O(1) |
| `ObjectPool` | `allocate` | O(1) | O(1) | O(1) |
| `ObjectPool` | `release` | O(1) | O(1) | O(1) |
| `ObjectPool` | `increaseCapacity` | O(k) | O(k) | O(k) |
| `ObjectPool` | `clearElements` | O(n) | O(n) | O(n) |
| `ObjectPool` | `query` | O(n) | O(n) | O(1) |
| `ObjectPool` | `query` result `delete()` | O(1) | O(1) | O(1) |
| `OctTree` | `insert` | O(n) | O(log n) | O(1) |
| `OctTree` | `find`, `contains` | O(n) | O(log n) | O(1) |
| `OctTree` | `remove`, `removeNode` | O(n²) | O(log² n) | O(1) |
| `OctTree` | `update` | O(n²) | O(log² n) | O(1) |
| `OctTree` | `withinBounds`, `withinRadius` | O(n) | O(n^(2/3) + k) | O(1) |
| `OctTree` | `nearest` | O(n) | O(log n) | O(1) |
| `OctTree` | `query` | O(n) | O(n) | O(1) |
| `OctTree` | `query` result `delete()` | O(n²) | O(log² n) | O(1) |
| `PriorityQueue` | `push` | O(log n) | O(1) | O(1) |
| `PriorityQueue` | `pop` | O(log n) | O(log n) | O(1) |
| `PriorityQueue` | `peek` | O(1) | O(1) | O(1) |
| `PriorityQueue` | `heapify` | O(n) | O(n) | O(n) |
| `PriorityQueue` | `query` | O(n) | O(n) | O(1) |
| `PriorityQueue` | `query` result `delete()` | O(n) | O(n) | O(1) |
| `QuadTree` | `insert` | O(n) | O(log n) | O(1) |
| `QuadTree` | `find`, `contains` | O(n) | O(log n) | O(1) |
| `QuadTree` | `remove`, `removeNode` | O(n²) | O(log² n) | O(1) |
| `QuadTree` | `update` | O(n²) | O(log² n) | O(1) |
| `QuadTree` | `withinBounds`, `withinRadius` | O(n) | O(√n + k) | O(1) |
| `QuadTree` | `nearest` | O(n) | O(log n) | O(1) |
| `QuadTree` | `query` | O(n) | O(n) | O(1) |
| `QuadTree` | `query` result `delete()` | O(n²) | O(log² n) | O(1) |
| `Queue` | `push` | O(1) | O(1) | O(1) |
| `Queue` | `pop` | O(1) | O(1) | O(1) |
| `Queue` | `front`, `rear`, `at` | O(1) | O(1) | O(1) |
| `Queue` | `reverse` | O(n) | O(n) | O(n) |
| `Queue` | `query` | O(n) | O(n) | O(1) |
| `Queue` | `query` result `delete()` | O(n) | O(n) | O(n) |
| `RedBlackTree` | `insert` | O(log n) | O(log n) | O(log n) |
| `RedBlackTree` | `find`, `contains` | O(log n) | O(log n) | O(log n) |
| `RedBlackTree` | `remove` | O(log n) | O(log n) | O(log n) |
| `RedBlackTree` | `removeNode` | O(log n) | O(log n) | O(1) |
| `RedBlackTree` | `update` | O(log n) | O(log n) | O(1) |
| `RedBlackTree` | `min`, `max` | O(log n) | O(log n) | O(log n) |
| `RedBlackTree` | `successor`, `predecessor` | O(log n) | O(1) | O(1) |
| `RedBlackTree` | `query` | O(n) | O(n) | O(log n) |
| `RedBlackTree` | `query` result `delete()` | O(log n) | O(log n) | O(1) |
| `SpatialHash` | `insert` | O(n) | O(1) | O(1) |
| `SpatialHash` | `find`, `contains`, `remove` | O(n) | O(1 + s) | O(1) |
| `SpatialHash` | `removeNode` | O(1) | O(1) | O(1) |
| `SpatialHash` | `update` | O(n) | O(1) | O(1) |
| `SpatialHash` | `withinBounds`, `withinRadius` | O(c + n) | O(c + k) | O(1) |
| `SpatialHash` | `nearest` | O(n) | O(1) | O(1) |
| `SpatialHash` | `query` | O(n) | O(n) | O(1) |
| `SpatialHash` | `query` result `delete()` | O(1) | O(1) | O(1) |
| `SpatialMap` | `insert`, `update` | O(n) | O(1) | O(1) |
| `SpatialMap` | `find`, `findCell`, `contains`, `containsCell`, `remove` | O(n) | O(1) | O(1) |
| `SpatialMap` | `removeNode` | O(1) | O(1) | O(1) |
| `SpatialMap` | `withinBounds`, `withinRadius` | O(c + n) | O(c + k) | O(1) |
| `SpatialMap` | `nearest` | O(n) | O(1) | O(1) |
| `SpatialMap` | `query` | O(n) | O(n) | O(1) |
| `SpatialMap` | `query` result `delete()` | O(1) | O(1) | O(1) |
| `Stack` | `push` | O(1) | O(1) | O(1) |
| `Stack` | `pop` | O(1) | O(1) | O(1) |
| `Stack` | `top`, `bottom`, `at` | O(1) | O(1) | O(1) |
| `Stack` | `reverse` | O(n) | O(n) | O(n) |
| `Stack` | `query` | O(n) | O(n) | O(1) |
| `Stack` | `query` result `delete()` | O(n) | O(n) | O(1) |
| `Trie` | `insert` | O(m log σ + σ) | O(m log σ) | O(m) |
| `Trie` | `find`, `get`, `contains` | O(m log σ) | O(m log σ) | O(1) |
| `Trie` | `remove` | O(m log σ + σ) | O(m log σ) | O(1) |
| `Trie` | `removeNode` | O(m log σ + σ) | O(1) | O(1) |
| `Trie` | `hasPrefix` | O(p log σ) | O(p log σ) | O(1) |
| `Trie` | `longestPrefixOf` | O(min(t, L) log σ) | O(min(t, L) log σ) | O(1) |
| `Trie` | `withPrefix`, `keysWithPrefix`, `forEachWithPrefix` | O((p + S) log σ) | O((p + S) log σ) | O(p log σ) |
| `Trie` | `min`, `max` | O(L) | O(L) | O(1) |
| `Trie` | `successor`, `predecessor` | O(L log σ) | O(log σ) | O(1) |
| `Trie` | `query` | O(N log σ) | O(N log σ) | O(m) |
| `Trie` | `query` result `delete()` | O(m log σ + σ) | O(1) | O(1) |
| All `Byte*` classes | `toBytes` | O(n) | O(n) | O(n) |
| `ByteDirectedGraph` | `toBytes`, rebuild from bytes | O(V + E) | O(V + E) | O(V + E) |
| `ByteBinarySearchTree`, `ByteQuadTree`, `ByteOctTree` | rebuild from bytes | O(n²) | O(n log n) | O(n log n) |
| `ByteRedBlackTree`, `BytePriorityQueue` | rebuild from bytes | O(n log n) | O(n) | O(n) |
| `ByteTrie` | rebuild from bytes | O(N log σ) | O(N log σ) | O(N) |
| `ByteCircularQueue`, `ByteLinkedList`, `ByteQueue`, `ByteSpatialHash`, `ByteSpatialMap`, `ByteStack` | rebuild from bytes | O(n) | O(n) | O(n) |

Notes on the less obvious rows:

* **`RedBlackTree` lookups are O(log n) even in the best case.** Rotations can put equal items in left subtrees, so `find()` keeps walking left after a match to return the earliest inserted one.
* **Removing from `QuadTree` and `OctTree` relinks the removed node's subtree.** These are point trees, one item per node, so each node in the subtree is re-inserted. Removing a leaf is O(1). Removing the root of a degenerate tree is O(n²).
* **`QuadTree` and `OctTree` average cases assume well-spread points.** Nothing caps their depth, and coincident points chain into a single branch.
* **`SpatialHash` and `SpatialMap` costs are averages over the cell hash table.** The worst cases need nearly every cell to collide in the table. `nearest()` is O(1) on average when items fill the space around the search point evenly. It searches outward shell by shell, and once a shell would probe more cells than there are items, it measures every item instead, which caps it at O(n).
* **`PriorityQueue` `push` is O(1) on average** for random priorities, because the new item usually stops within a level or two.
* **`DirectedGraph` `find()` is Θ(V) even when the first vertex matches,** because it has no item-to-vertex index. Keep the vertex returned by `addVertex()` instead of searching for it. `removeVertex()` uses the reverse adjacency each vertex keeps, so it never scans other vertices.
* **`findPath()` assumes a consistent heuristic, or none (Dijkstra).** An admissible but inconsistent heuristic can re-expand vertices.
* **`Byte*` classes inherit every other operation unchanged.** Byte costs leave out the `ItemCodec`'s per-item encode and decode time. Bytes written by `toBytes()` rebuild a `ByteRedBlackTree` or `BytePriorityQueue` in O(n), because they are already in key or heap order.

## Allocation benchmark

`pnpm bench` runs [`bench/alloc.cjs`](bench/alloc.cjs), which measures the heap bytes each operation allocates once the structure has warmed up. The young generation is enlarged so no garbage collection runs during a measurement, which makes the heap growth equal to the bytes allocated. Each row is 200,000 operations after 20,000 warm-up operations, on Node.js 23.11.

| Operation | Bytes per operation |
|---|---:|
| `CircularQueue` push + pop | 0 |
| `CircularQueue` push with `overwrite` | 0 |
| `Queue` push + pop | 0 |
| `Stack` push + pop | 0 |
| `PriorityQueue` push + pop (100 items) | 0 |
| `LinkedList` insert + `removeNode` | 0 |
| `ObjectPool` allocate + release | 0 |
| `BinarySearchTree` insert + remove (1000 items) | 0 |
| `BinarySearchTree` `update()` move | 0 |
| `RedBlackTree` insert + remove (1000 items) | 0 |
| `RedBlackTree` `update()` move | 0 |
| `QuadTree` `nearest()` (1000 items) | 0 |
| `QuadTree` `forEachWithinBounds()` | 0 |
| `QuadTree` `forEachWithinRadius()` | 0 |
| `QuadTree` remove + insert | 0 |
| `OctTree` `nearest()` (1000 items) | 0 |
| `SpatialHash` `nearest()` (1000 items) | 0 |
| `SpatialHash` `forEachWithinRadius()` | 0 |
| `SpatialHash` `update()` move | 0 |
| `SpatialHash` remove + insert | 0 |
| `SpatialMap` `findCell()` | 0 |
| `SpatialMap` insert + `removeNode()` | 0 |
| `DirectedGraph` `forEachNeighbor()` | 0 |
| `DirectedGraph` `findPath()` A* on a 20 x 20 grid, reusing a path | 0 |
| `DirectedGraph` `addEdge()` + `removeEdge()` | 26 |

Graph edge changes allocate because V8 resizes the `Map` tables that hold adjacency. See [Pathfinding with `DirectedGraph`](#pathfinding-with-directedgraph).

## Compared with other packages

[`bench/compare.cjs`](bench/compare.cjs) runs the same measurement on equivalent operations in other packages. Each row holds 1000 items, then adds one and removes one per operation. Time is the median of three runs of 1,000,000 operations on Node.js 23.11 and varies by machine, so compare rows within the table rather than with other benchmarks.

| Structure | Package | Bytes per op | ns per op |
|---|---|---:|---:|
| FIFO queue | `@toreda/data-structures` `Queue` | 0 | 25 |
| FIFO queue | `denque` 2.1.0 | 0 | 25 |
| FIFO queue | `js-sdsl` 4.4.2 `Queue` | 0 | 24 |
| FIFO queue | `mnemonist` 0.40.5 `Queue` | 4 | 28 |
| FIFO queue | `@datastructures-js/queue` 4.3.0 | 2 | 30 |
| Ring buffer | `@toreda/data-structures` `CircularQueue` | 0 | 21 |
| Ring buffer | `mnemonist` 0.40.5 `CircularBuffer` | 0 | 18 |
| Binary heap | `@toreda/data-structures` `PriorityQueue` | 0 | 80 |
| Binary heap | `js-sdsl` 4.4.2 `PriorityQueue` | 0 | 83 |
| Binary heap | `mnemonist` 0.40.5 `Heap` | 0 | 147 |
| Binary heap | `@datastructures-js/priority-queue` 6.4.0 | 0 | 309 |
| Sorted set | `@toreda/data-structures` `RedBlackTree` | 0 | 496 |
| Sorted set | `js-sdsl` 4.4.2 `OrderedSet` | 2 | 390 |
| Doubly linked list | `@toreda/data-structures` `LinkedList` | 0 | 95 |
| Doubly linked list | `js-sdsl` 4.4.2 `LinkList` | 48 | 211 |
| Doubly linked list | `@datastructures-js/linked-list` 6.1.4 | 48 | 72 |

What the numbers show:

* **Array-backed structures are close across packages.** Queues, ring buffers, and heaps allocate little or nothing in every package tested, because they reuse an array.
* **Node-based structures are where pooling matters.** The other linked lists allocate a new node for every insert. `LinkedList` reuses pooled nodes and allocates nothing. The same pooling applies to `BinarySearchTree`, `RedBlackTree`, `QuadTree`, `OctTree`, `SpatialHash`, `SpatialMap`, and `DirectedGraph`.
* **`js-sdsl`'s `OrderedSet` is faster.** It took about 20% less time per operation than `RedBlackTree` here.

This package also has structures the others don't: dynamic `QuadTree` and `OctTree` spatial indexes with insert, remove, and move (`mnemonist`'s `KDTree` and `VPTree` are built once from a fixed dataset), `SpatialHash` and `SpatialMap` uniform grids, `DirectedGraph` with A* pathfinding, `ObjectPool` for your own objects, and `Byte*` subclasses that encode a whole collection to bytes.

## When to use something else

* **You need structures this package doesn't have.** `mnemonist` has LRU caches, Bloom filters, bit sets, multimaps, and suffix arrays. `js-sdsl` has hash maps and sets, deques, and ordered maps.
* **You only need a double-ended queue.** `denque` is a small, single-purpose package.
* **You need the fastest sorted set and allocation doesn't matter.** `js-sdsl`'s `OrderedSet` and `OrderedMap` were faster in the comparison above.
* **Thousands of spatial items all move every frame.** Point trees relink on moves. Use `SpatialHash` from this package, or a per-frame rebuild.
* **A graph's edges change every frame.** Edge changes still allocate inside V8's `Map` tables. Build the graph up front and keep per-frame work to lookups, `forEachNeighbor()`, and `findPath()`.

# **`DataStructure` Interface**
Every collection is generic over its item type and implements the `DataStructure` interface:

```typescript
interface DataStructure<ItemT> {
	clearElements(): void;
	reset(): void;
	stringify(): string | null;
	query(
		query: QueryFilter<ItemT> | QueryFilter<ItemT>[],
		options?: QueryOptions
	): QueryResult<ItemT>[] | QueryResult<Element<ItemT>, ItemT>[];
}
```

Node-based collections (`LinkedList`, `BinarySearchTree`, `RedBlackTree`, `QuadTree`, `OctTree`, `SpatialHash`, `SpatialMap`, `DirectedGraph`, `Trie`) wrap each item in an element that implements `Element<T>`, whose `value()` reads the item. Tree collections also implement the shared `Tree` interface, and graph collections the shared `Graph` interface.

Methods return `null` instead of throwing when a collection is empty or holds no matching item, for example `pop()` on an empty `Stack`.

# Data Structures

## **`BinarySearchTree<T>`**

Unbalanced binary search tree ordered by a comparator you provide. Each node's left subtree holds smaller items and its right subtree holds equal or larger items, so walking the tree in order visits items sorted. Search, insert, and removal take O(h), where h is the tree's height: O(log n) on average for items inserted in random order, O(n) for items inserted already sorted. Implements the shared `Tree` interface.

The comparator is required and works like the `Array.prototype.sort` compare function: negative when `a` sorts first, positive when `b` sorts first, `0` when equal.

### Basics

Typescript

```typescript
// Import
import {BinarySearchTree, BinarySearchTreeComparator} from '@toreda/data-structures';

// Instantiate. The comparator is required and throws when it is not a function.
const byNumber: BinarySearchTreeComparator<number> = (a, b) => a - b;
const tree = new BinarySearchTree<number>(byNumber);

// Instantiate with starting items, inserted in array order
const treeWithItems = new BinarySearchTree<number>(byNumber, [50, 30, 70, 20, 40, 60, 80]);
//         50
//       /    \
//     30      70
//    /  \    /  \
//   20  40  60  80

// Insert items. Returns the node now holding the item.
const node = tree.insert(50); // returns BinarySearchTreeElement holding 50
tree.insertArray([30, 70]); // inserts each item in array order

// Size and shape
treeWithItems.size(); // returns 7
treeWithItems.isEmpty(); // returns false
treeWithItems.height(); // returns 2 (edges on the longest root to leaf path; -1 when empty)
treeWithItems.depth(treeWithItems.find(40)); // returns 2 (edges up to the root)

// Search
treeWithItems.contains(40); // returns true
treeWithItems.find(40); // returns the node holding 40
treeWithItems.find(45); // returns null

// Smallest and largest items
treeWithItems.min()?.value(); // returns 20
treeWithItems.max()?.value(); // returns 80

// Remove by item, or by node
treeWithItems.remove(30); // returns 30
treeWithItems.remove(45); // returns null because no item equals 45
treeWithItems.removeNode(treeWithItems.find(70)); // returns 70
treeWithItems.values(); // returns [20, 40, 50, 60, 80]

// Remove every item. The comparator and options are kept.
treeWithItems.reset(); // returns treeWithItems
```

### Traversal and iteration

Every traversal is iterative, so even a lopsided tree built from sorted input never overflows the call stack.

```typescript
const tree = new BinarySearchTree<number>((a, b) => a - b, [50, 30, 70, 20, 40, 60, 80]);

// Traversal orders
tree.values(); // returns [20, 30, 40, 50, 60, 70, 80] (same as inOrder)
tree.inOrder(); // returns [20, 30, 40, 50, 60, 70, 80]
tree.preOrder(); // returns [50, 30, 20, 40, 70, 60, 80]
tree.postOrder(); // returns [20, 40, 30, 60, 80, 70, 50]
tree.levelOrder(); // returns [50, 30, 70, 20, 40, 60, 80]

// Inserting preOrder() output into an empty tree rebuilds the same shape
const copy = new BinarySearchTree<number>((a, b) => a - b, tree.preOrder());

// Iterate items in sorted order
for (const item of tree) {
	console.log(item); // outputs 20, 30, 40, 50, 60, 70, 80
}

// forEach visits nodes in sorted order. The third argument is the tree itself
// (like Map/Set.forEach). The callback may remove the current node.
tree.forEach((node, index, source) => {
	console.log(node.value() + ' is at index ' + index + ' of ' + source.size());
}); // returns tree
// outputs '20 is at index 0 of 7'
// ...
// outputs '80 is at index 6 of 7'

// Walk nodes in either direction
let next = tree.min(); // node holding 20
next = tree.successor(next); // node holding 30
let prev = tree.max(); // node holding 80
prev = tree.predecessor(prev); // node holding 70

// Nodes also expose their links
const root = tree.root(); // node holding 50
root?.left()?.value(); // returns 30
root?.right()?.value(); // returns 70
root?.children(); // returns [node holding 30, node holding 70]
root?.left()?.parent() === root; // true
tree.find(20)?.isLeaf(); // returns true
```

### Objects ordered by key

Items can be any type. The comparator decides the order, and items are never copied.

```typescript
interface Player {
	name: string;
	score: number;
}

const byScore = (a: Player, b: Player): number => a.score - b.score;
const leaderboard = new BinarySearchTree<Player>(byScore, [
	{name: 'ana', score: 120},
	{name: 'ben', score: 90},
	{name: 'cy', score: 150}
]);

leaderboard.min()?.value()?.name; // returns 'ben'
leaderboard.max()?.value()?.name; // returns 'cy'

// Look up by key: only fields the comparator reads matter
leaderboard.find({name: '', score: 120})?.value()?.name; // returns 'ana'

// Top scores first: walk backwards from max()
const top: string[] = [];
for (let node = leaderboard.max(); node; node = leaderboard.predecessor(node)) {
	top.push(node.value()!.name);
}
// top is ['cy', 'ana', 'ben']
```

### Updating items after insertion

The tree cannot see changes made to an item after it was inserted. After changing a field the comparator reads, call `update(node, item)`. When the item still belongs where its node sits, nothing moves. Otherwise the same node is unlinked and relinked where the item now belongs, without going through the node pool. Either way the same node is returned, and query results that point at it stay valid.

```typescript
const node = leaderboard.find({name: '', score: 90})!; // node holding ben

// Change the item in place, then pass the node's own item
const ben = node.value()!;
ben.score = 200;
leaderboard.update(node, ben); // returns node, now in the max position

leaderboard.max()?.value()?.name; // returns 'ben'

// Or replace the item with a new one
const numbers = new BinarySearchTree<number>((a, b) => a - b, [50, 30, 70]);
numbers.update(numbers.find(50), 10); // returns the node now holding 10
numbers.values(); // returns [10, 30, 70]

// Nodes that are null or belong to another tree are ignored
numbers.update(null, 5); // returns null
```

Setting a value directly with `node.value(x)` only takes effect when `x` compares equal to the current value, because anything else would break the tree's order. Use `update()` for other changes.

### Duplicates

Duplicates are allowed by default. An item equal to existing items is placed after them, so equal items stay in insertion order. `find()` and `remove()` act on the earliest one.

```typescript
const byKey = (a: {k: number}, b: {k: number}): number => a.k - b.k;
const first = {k: 1};
const second = {k: 1};
const tree = new BinarySearchTree<{k: number}>(byKey, [first, second]);

tree.size(); // returns 2
tree.find({k: 1})?.value() === first; // true
tree.remove({k: 1}) === first; // true
```

Set `allowDuplicates: false` to keep items unique. A duplicate is not added, and instead of throwing, the method returns the `duplicate_not_allowed` error code (type `BinarySearchTreeError`). Only a strict boolean is accepted; any other value keeps the default of `true`.

```typescript
import {BinarySearchTree, BinarySearchTreeError} from '@toreda/data-structures';

const unique = new BinarySearchTree<number>((a, b) => a - b, [5, 3, 5, 8], {allowDuplicates: false});
unique.values(); // returns [3, 5, 8]. Duplicates in constructor data and insertArray are skipped.

const result = unique.insert(3); // returns 'duplicate_not_allowed'
if (result === 'duplicate_not_allowed') {
	// 3 is already in the tree and nothing was added
}

unique.insert(4); // returns the node holding 4

// update() also returns the code when the new item equals another item.
// The node is removed in that case, so the item is no longer in the tree.
unique.update(unique.find(4), 8); // returns 'duplicate_not_allowed'
unique.values(); // returns [3, 5, 8]
```

### Filter, query, and serialize

```typescript
const tree = new BinarySearchTree<number>((a, b) => a - b, [50, 30, 70, 20, 40, 60, 80]);

// New tree with matching items. It keeps this tree's comparator and options,
// and is built balanced because the items are already sorted.
const evens = tree.filter((node) => node.value()! % 20 === 0); // items [20, 40, 60, 80]

// Query matches in sorted order. Filters in an array must all match.
const results = tree.query([(v) => v > 25, (v) => v < 65], {limit: 2});
results[0].element.value(); // returns 30
results[1].element.value(); // returns 40
results[0].delete(); // returns 30 and removes it from tree
results[0].delete(); // returns null because it was already removed

// Items in sorted order as a JSON string
tree.stringify(); // returns '{"type":"BinarySearchTree","elements":[20,40,50,60,70,80]}'

// Byte form of the whole tree is provided by ByteBinarySearchTree, a superset of
// BinarySearchTree. It takes an ItemCodec, then the comparator. Items are encoded
// in pre-order, so rebuilding from the bytes gives the same tree shape.
import {ByteBinarySearchTree} from '@toreda/data-structures';

const codec = {
	encode: (item: number): Uint8Array => new Uint8Array(new Float64Array([item]).buffer),
	decode: (bytes: Uint8Array): number => new Float64Array(bytes.slice().buffer)[0]
};

const source = new ByteBinarySearchTree<number>(codec, (a, b) => a - b, [50, 30, 70]);
const fromBytes = new ByteBinarySearchTree<number>(codec, (a, b) => a - b, source.toBytes());
fromBytes.preOrder(); // returns [50, 30, 70]
```

### Node pooling

Node wrappers are pooled by default. A removed node is recycled for a later insert, so once the pool has grown, inserts and removals in steady state create no new objects. After a node is removed, don't use it again; read the removed item from the return value of `remove()` or `removeNode()`. With pooling off, a removed node is blanked, so it no longer holds its item.

`pool.maxSize` is a hard cap on pooled nodes. When more nodes are in use than the cap, the extra ones are created normally and left to the garbage collector when removed, instead of being pooled.

```typescript
// Tune the internal pool with ObjectPool options. Omitted entries keep the defaults.
const pooled = new BinarySearchTree<number>((a, b) => a - b, [], {pool: {startSize: 64, maxSize: 4096}});

// Only strict `true` disables pooling
const unpooled = new BinarySearchTree<number>((a, b) => a - b, [], {disableElementPooling: true});
```

## **`CircularQueue<T>`**

Fixed capacity FIFO queue backed by a ring buffer. Items are added at the rear and removed from the front in O(1). Every traversal (`forEach`, `filter`, `query`, iteration, `getIndex`) runs from the front to the rear, and position 0 is the front.

Options: `maxSize` (a positive integer, default `25`) and `overwrite` (a strict boolean, default `false`). An invalid option falls back to its default and never throws.

### Circular queue basics

Typescript

```typescript
// Import
import {CircularQueue} from '@toreda/data-structures';

// Instantiate
const circularQueueDefault = new CircularQueue<number>(); // maxSize 25, overwrite false
const circularQueueWithOptions = new CircularQueue<number>([], {maxSize: 999, overwrite: true});
// Instantiate with starting items, pushed front to rear
const circularQueueWithItems = new CircularQueue<number>([1, 2, 3], {maxSize: 10});
circularQueueWithItems.front(); // returns 1

// Items beyond maxSize are dropped, or with overwrite only the last maxSize are kept
new CircularQueue<number>([1, 2, 3, 4], {maxSize: 3}).values(); // returns [1, 2, 3]
new CircularQueue<number>([1, 2, 3, 4], {maxSize: 3, overwrite: true}).values(); // returns [2, 3, 4]
```

### Use as a queue

```typescript
// Use as Queue
const circularQueue = new CircularQueue<number>([], {maxSize: 4});

// Add items to the rear of the queue. Returns false once the queue is full.
circularQueue.push(10); // returns true
circularQueue.push(20); // returns true
circularQueue.push(30); // returns true
circularQueue.push(40); // returns true
circularQueue.push(50); // returns false

// Get queue size
circularQueue.size(); // returns 4
circularQueue.isFull(); // returns true

// Get the front item
circularQueue.front(); // returns 10
circularQueue.peek(); // alias of front(), returns 10

// Get the rear item
circularQueue.rear(); // returns 40

// Get the item at a position from the front
circularQueue.getIndex(1); // returns 20
circularQueue.getIndex(2); // returns 30
circularQueue.getIndex(4); // returns null, outside the queue

// Negative positions count back from the rear, like Array.prototype.at
circularQueue.getIndex(-1); // returns 40
circularQueue.getIndex(-2); // returns 30

// Remove and return the front item
circularQueue.pop(); // returns 10
circularQueue.pop(); // returns 20
circularQueue.size(); // returns 2
circularQueue.pop(); // returns 30
circularQueue.pop(); // returns 40
circularQueue.size(); // returns 0
circularQueue.pop(); // returns null

// push and insertFront take one item. pushArray adds several at the rear in
// array order. insertFrontArray adds them at the front one at a time, so the
// last item ends up in front.
circularQueue.pushArray([1, 2, 3]); // returns true
circularQueue.insertFront(0); // returns true; queue is now 0, 1, 2, 3
circularQueue.push(9); // returns false because the queue is full

// clearElements keeps the ring buffer's slots for reuse
circularQueue.clearElements(); // returns circularQueue
circularQueue.pushArray([10, 20, 30]); // returns true
```

### Use as a buffer

```typescript
// Use as Buffer. When full, each push overwrites the front item.
const circularBuffer = new CircularQueue<number>([], {maxSize: 4, overwrite: true});

// Add items to the buffer
circularBuffer.push(10); // returns true
circularBuffer.push(20); // returns true
circularBuffer.push(30); // returns true
circularBuffer.push(40); // returns true
circularBuffer.push(50); // returns true and overwrites 10

// Get buffer size
circularBuffer.size(); // returns 4

// Get the front item
circularBuffer.front(); // returns 20

// Get the rear item
circularBuffer.rear(); // returns 50

// Get the item at a position from the front
circularBuffer.getIndex(1); // returns 30
circularBuffer.getIndex(-1); // returns 50

// Remove items from the buffer
circularBuffer.pop(); // returns 20
circularBuffer.pop(); // returns 30
circularBuffer.size(); // returns 2
```

### Iterating a circular queue

```typescript
// Continuing with circularQueue from "Use as a queue", which holds 10, 20, 30
// Iterate from front to rear. index is the position from the front, and the
// third argument is the queue itself (like Map/Set.forEach).
circularQueue.pop(); // returns 10
circularQueue.push(40); // returns true
circularQueue.push(50); // returns true, wrapping around the end of the ring buffer
circularQueue.forEach((item, index, queue) => {
	console.log(item + ' is at index ' + index + ' of ' + queue.size());
}); // returns circularQueue
// outputs '20 is at index 0 of 4'
// outputs '30 is at index 1 of 4'
// outputs '40 is at index 2 of 4'
// outputs '50 is at index 3 of 4'

// Iterate items front to rear
for (const item of circularQueue) {
	console.log(item); // outputs 20, 30, 40, 50
}
circularQueue.values(); // returns [20, 30, 40, 50]

// New queue holding the matching items. Uses this queue's options.
const large = circularQueue.filter((item) => item > 25); // items [30, 40, 50], maxSize 4
```

### Serialize a circular queue

```typescript
// Returns queue items, front to rear, as a JSON string
const serialized = circularQueue.stringify(); // returns '{"type":"CircularQueue","elements":[20,30,40,50]}'

// Reset queue and remove all items. Options are kept.
circularQueue.reset(); // returns circularQueue

// Byte form of the whole queue is provided by ByteCircularQueue, a superset of
// CircularQueue. Items are generic, so it requires an ItemCodec at construction.
import {ByteCircularQueue} from '@toreda/data-structures';

const codec = {
	encode: (item: number): Uint8Array => new Uint8Array([item]),
	decode: (bytes: Uint8Array): number => bytes[0]
};

const source = new ByteCircularQueue<number>(codec, [1, 2, 3], {maxSize: 8});
const bytes = source.toBytes(); // Uint8Array, same as source.toByteEnvelope().toBytes()

// Rebuild a queue from envelope bytes. Throws when bytes are not a valid envelope.
const fromBytes = new ByteCircularQueue<number>(codec, bytes, {maxSize: 8});
fromBytes.values(); // returns [1, 2, 3]
```

## **`DirectedGraph<T>`**

Graph of vertices joined by weighted edges. Each edge is either one-way (`addEdge`), traveled only from its source to its target, or bidirectional (`addBidirectionalEdge`), traveled either way. Both kinds can be mixed in one graph; a graph using only bidirectional edges behaves as an undirected graph. Implements the shared `Graph` interface.

Adding and removing an edge, and checking whether two vertices are adjacent, take O(1). Removing a vertex takes O(d), where d is the number of edges touching it. Traversals and cycle detection take O(V + E), and `findPath()` takes O(E log V) without a heuristic or with a consistent one (see [Cheapest paths with A*](#cheapest-paths-with-a)). Every walk is iterative, so long paths never overflow the call stack.

Vertices are handles: the graph never compares its items, and one item can be added as several vertices. Keep the vertex returned by `addVertex()`, or look one up with `find(item)` in O(V).

### Graph basics

Typescript

```typescript
import {DirectedGraph, DirectedGraphEdge, DirectedGraphVertex} from '@toreda/data-structures';

const graph = new DirectedGraph<string>();

// Add vertices. Each returns the vertex holding the item.
const home = graph.addVertex('home');
const park = graph.addVertex('park');
const shop = graph.addVertex('shop');
const work = graph.addVertex('work');

// Add edges with an optional weight (default 1)
graph.addBidirectionalEdge(home, park, 2); // home <-> park
graph.addBidirectionalEdge(park, work, 2); // park <-> work
graph.addEdge(home, shop, 1); // home -> shop
graph.addEdge(shop, work, 5); // shop -> work

graph.size(); // returns 4 (vertices)
graph.edgeCount(); // returns 4 (a bidirectional edge counts once)
graph.adjacent(home, shop); // returns true
graph.adjacent(shop, home); // returns false (one-way)
graph.adjacent(park, home); // returns true (bidirectional)
graph.neighbors(home); // returns [park, shop]
graph.edge(home, shop)?.weight(); // returns 1

// Visit neighbors without allocating, for per-frame AI and steering queries.
// Define the callback once, outside the frame loop.
const logNeighbor = (neighbor: DirectedGraphVertex<string>, edge: DirectedGraphEdge<string>): void => {
	console.log(neighbor.value() + ' costs ' + edge.weight());
};
graph.forEachNeighbor(home, logNeighbor); // outputs 'park costs 2', then 'shop costs 1'
```

### Edge errors

```typescript
// Edges that cannot be added return an error code (type DirectedGraphError) instead of throwing
graph.addEdge(home, shop); // returns 'edge_exists'
graph.addEdge(home, park); // returns 'edge_exists' (home -> park is already covered)
graph.addEdge(home, null); // returns 'vertex_not_in_graph'
graph.addEdge(shop, home, -1); // returns 'invalid_weight' (weights must be finite and 0 or more)
```

### Traversal and removal

```typescript
// Traversals follow edges in their direction of travel
graph.breadthFirst(home); // returns [home, park, shop, work]
graph.depthFirst(home); // returns [home, park, work, shop]
graph.depthFirst(); // omit start to walk every vertex, including unreachable ones

// Remove an edge, or a vertex along with its edges
graph.removeEdge(graph.edge(home, shop)); // returns true
graph.removeVertex(shop); // returns 'shop'
```

### Cheapest paths with A*

`findPath(start, goal, heuristic?)` returns the cheapest path as `{vertices, edges, cost}`, or `null` when the goal cannot be reached. The optional heuristic estimates the remaining cost from a vertex to the goal and steers the search toward it. It must never overestimate, or the path found may not be the cheapest. Without one, the search runs as Dijkstra's algorithm.

The search takes O(E log V) when the heuristic is also consistent: for every edge from `u` to `v`, the estimate at `u` is at most the edge's weight plus the estimate at `v`. Straight-line distance on a map and Manhattan distance on a 4-way grid are both consistent. A heuristic that never overestimates but is not consistent still finds the cheapest path, but may expand some vertices more than once, so the search can take longer.

```typescript
// Using the home / park / shop / work graph as first built above
import {DirectedGraphPath} from '@toreda/data-structures';

const path = graph.findPath(home, work);
path?.vertices; // returns [home, park, work]
path?.cost; // returns 4 (cheaper than home -> shop -> work, which costs 6)

// Bidirectional edges are traveled either way, one-way edges only forward
graph.findPath(work, shop)?.vertices; // returns [work, park, home, shop]

// Pass a path object to refill instead of getting a new one. Each graph also
// reuses its search state, so repeated searches do not churn.
const reused: DirectedGraphPath<string> = {vertices: [], edges: [], cost: 0};
graph.findPath(home, work, null, reused); // returns reused, now holding the path

// Grid search with a Manhattan distance heuristic

type Cell = {x: number; y: number};
const grid = new DirectedGraph<Cell>();
const manhattan = (vertex: DirectedGraphVertex<Cell>, goal: DirectedGraphVertex<Cell>): number => {
	const a = vertex.value()!;
	const b = goal.value()!;
	return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
};
// ...add a vertex per cell and a bidirectional edge between neighboring cells
grid.findPath(startCell, goalCell, manhattan);
```

### Cycle detection

`hasCycle()` checks for a path that returns to its first vertex without using any edge twice, following each edge in a direction it can be traveled. It works for any mix of one-way and bidirectional edges, and for graphs split into several disconnected parts.

```typescript
// Using the home / park / shop / work graph as first built above
graph.hasCycle(); // returns true: home -> shop -> work -> park -> home

graph.removeEdge(graph.edge(shop, work));
graph.hasCycle(); // returns false

// Going back over one bidirectional edge uses it twice, so that is not a cycle
const pair = new DirectedGraph<string>();
const [a, b] = pair.addVertexArray(['a', 'b']);
pair.addBidirectionalEdge(a, b);
pair.hasCycle(); // returns false

// Two one-way edges in opposite directions are one
pair.removeEdge(pair.edge(a, b));
pair.addEdge(a, b);
pair.addEdge(b, a);
pair.hasCycle(); // returns true
```

### Filter, query, and serialize a graph

```typescript
// New graph with the matching vertices and every edge between them
const noShop = graph.filter((vertex) => vertex.value() !== 'shop');

// Query vertices by item, in insertion order. delete() removes the vertex and its edges.
const results = graph.query((item) => item.startsWith('p'));
results[0].element.value(); // returns 'park'

// Vertex items in insertion order, and edges by vertex index
graph.stringify();
// returns '{"type":"DirectedGraph","vertices":["home","park","shop","work"],
//   "edges":[{"from":0,"to":1,"weight":2,"bidirectional":true},...]}'

// Byte form of the whole graph, edges included, is provided by ByteDirectedGraph,
// a superset of DirectedGraph. Items are generic, so it requires an ItemCodec.
import {ByteDirectedGraph} from '@toreda/data-structures';

const codec = {
	encode: (item: string): Uint8Array => new TextEncoder().encode(item),
	decode: (bytes: Uint8Array): string => new TextDecoder().decode(bytes)
};

const source = new ByteDirectedGraph<string>(codec, ['a', 'b']);
const [va, vb] = source.vertices();
source.addEdge(va, vb, 3);
const bytes = source.toBytes(); // Uint8Array: vertex items, then every edge

// Rebuild the graph, vertices and edges, from bytes. Throws when bytes are malformed.
const fromBytes = new ByteDirectedGraph<string>(codec, bytes);
fromBytes.edgeCount(); // returns 1
```

### Vertex and edge pooling

Vertex and edge wrappers are pooled by default, so once the pools have grown, adding and removing vertices and edges creates no new wrapper objects. V8 still resizes the graph's internal `Map` tables as entries are added and removed, so frequent edge and vertex changes produce some garbage. The `pool` options apply to both pools. After a vertex or edge is removed, don't use it again; read the removed item from the return value of `removeVertex()`.

```typescript
const pooled = new DirectedGraph<string>([], {pool: {startSize: 64}});
const unpooled = new DirectedGraph<string>([], {disableElementPooling: true});
```

## `LinkedList<T>`

Doubly linked list. Each item is wrapped in a `LinkedListElement` node with `prev()` and `next()` links. Removing a node takes O(1).

### Linked list basics

Typescript

```typescript
// Import
import {LinkedList} from '@toreda/data-structures';

// Instantiate
const myLinkedList = new LinkedList<string>();
// Instantiate with starting elements, inserted head to tail
const myLinkedListWithElements = new LinkedList<string>(['a', 'b', 'c']);

// Add elements to the tail of linked list
myLinkedList.insert('my string 1'); // returns the LinkedListElement holding 'my string 1'
myLinkedList.insert('my string 2'); // returns the LinkedListElement holding 'my string 2'
myLinkedList.insertAtTail('my string 3'); // same as insert()

// Add elements to the head of linked list
myLinkedList.insertAtHead('my string 0'); // returns the LinkedListElement holding 'my string 0'

// Add each element of an array to the tail
myLinkedListWithElements.insertArray(['d', 'e']);

// Get linked list size
myLinkedList.size(); // returns 4
myLinkedList.isEmpty(); // returns false
```

### Walking nodes

```typescript
// Get head and tail nodes
const head = myLinkedList.head()!; // node holding 'my string 0'
const tail = myLinkedList.tail()!; // node holding 'my string 3'

// Get value of linked list element
head.value(); // returns 'my string 0'
tail.value(); // returns 'my string 3'

// Set value of linked list element
head.value('MY STRING 0'); // returns null

// Move to next linked node
let next = head.next(); // node holding 'my string 1'
next = next!.next(); // node holding 'my string 2'
next = next!.next(); // node holding 'my string 3'
next = next!.next(); // returns null

// Move to previous linked node
let prev = tail.prev(); // node holding 'my string 2'
prev = prev!.prev(); // node holding 'my string 1'
prev = prev!.prev(); // node holding 'MY STRING 0'
prev = prev!.prev(); // returns null
```

### Iterating a linked list

```typescript
// Iterate through elements. Walks node links directly without building an array;
// the third argument is the list itself (like Map/Set.forEach).
myLinkedList.forEach((elem, index, list) => {
	console.log(elem.value() + ' is at index ' + index + ' of ' + list.size());
}); // returns myLinkedList
// outputs 'MY STRING 0 is at index 0 of 4'
// outputs 'my string 1 is at index 1 of 4'
// outputs 'my string 2 is at index 2 of 4'
// outputs 'my string 3 is at index 3 of 4'

// Iterate values head to tail
for (const value of myLinkedList) {
	console.log(value); // outputs 'MY STRING 0', 'my string 1', 'my string 2', 'my string 3'
}
```

### Remove, filter, and reverse

```typescript
// Remove nodes from linked list in O(1). Returns the removed value.
myLinkedList.removeNode(head); // returns 'MY STRING 0'
myLinkedList.removeNode(tail); // returns 'my string 3'
myLinkedList.removeNode(tail); // returns null because tail was already removed
myLinkedList.head()?.value(); // returns 'my string 1'
myLinkedList.tail()?.value(); // returns 'my string 2'

// Values head to tail
myLinkedList.values(); // returns ['my string 1', 'my string 2']

// New list holding the values of matching nodes. Uses this list's options.
const filtered = myLinkedList.filter((elem) => elem.value() === 'my string 2');
filtered.values(); // returns ['my string 2']

// Reset linked list and remove all elements
myLinkedList.reset(); // returns myLinkedList

// Reverse the order of list elements.
// Head to tail 'one', 'two', 'three' becomes 'three', 'two', 'one'.
myLinkedList.insertArray(['one', 'two', 'three']);
myLinkedList.reverse(); // returns myLinkedList
```

### Serialize a linked list

```typescript
// Returns list values as a JSON string
const serialized = myLinkedList.stringify(); // returns '{"type":"LinkedList","elements":["three","two","one"]}'

// Byte form of the whole list is provided by ByteLinkedList, a superset of
// LinkedList. Items are generic, so it requires an ItemCodec at construction.
import {ByteLinkedList} from '@toreda/data-structures';

const codec = {
	encode: (item: string): Uint8Array => new TextEncoder().encode(item),
	decode: (bytes: Uint8Array): string => new TextDecoder().decode(bytes)
};

const source = new ByteLinkedList<string>(codec, ['a', 'b']);
const envelope = source.toByteEnvelope(); // ByteEnvelope: directory header + item bytes
const bytes = source.toBytes(); // Uint8Array, same as envelope.toBytes()

// Rebuild a list from envelope bytes. Throws when bytes are not a valid envelope.
const fromBytes = new ByteLinkedList<string>(codec, bytes);
fromBytes.values(); // returns ['a', 'b']
```

### Linked list node pooling

```typescript
// Node wrappers are pooled and recycled by default. Only strict `true` turns it off.
// A removed node is blanked, pooled or not, so read the item from removeNode's return value.
const myUnpooledLinkedList = new LinkedList<string>([], {disableElementPooling: true});
// Tune the internal pool with ObjectPool options. Omitted entries keep the list's defaults.
// maxSize is a hard cap: nodes beyond it are left to the garbage collector, not pooled.
const myTunedLinkedList = new LinkedList<string>([], {pool: {startSize: 64, maxSize: 4096}});
```

## **`ObjectPool<T>`**

Pool of reusable object instances. Objects are created up front and handed out by `allocate()`, and `release()` cleans them with `cleanObj()` and stores them for reuse.

Default options: `startSize: 1`, `maxSize: 1000`, `autoIncrease: false`, `increaseBreakPoint: 1`, `increaseFactor: 2`. With `autoIncrease` on, the pool grows by `increaseFactor` once the share of objects in use would pass `increaseBreakPoint`, up to `maxSize`.

### Defining a pooled class

Typescript

```typescript
// Import
import {ObjectPool, ObjectPoolInstance} from '@toreda/data-structures';

// Pooled classes implement cleanObj(), which resets the object for reuse
class ObjectClass implements ObjectPoolInstance {
	public name!: string;
	public amount!: number;

	constructor() {
		this.cleanObj();
	}

	cleanObj(): void {
		this.name = 'cleaned';
		this.amount = 0;
	}
}
```

### Allocating objects

```typescript
// Instantiate. The class constructor is required and throws when it is not a function.
const objectPoolDefault = new ObjectPool<ObjectClass>(ObjectClass);
objectPoolDefault.allocate(); // returns an ObjectClass instance
objectPoolDefault.allocate(); // returns null: default pool holds 1 object and does not grow

const objectPool = new ObjectPool<ObjectClass>(ObjectClass, {
	startSize: 100,
	maxSize: 1000,
	autoIncrease: true,
	increaseBreakPoint: 0.9,
	increaseFactor: 2
});

// Get 1 object from the pool
const obj1 = objectPool.allocate(); // returns an ObjectClass instance, or null when none is available

// Get array of n objects from the pool
const objs = objectPool.allocateMultiple(10); // returns array of 10 ObjectClass instances
```

### Pool capacity and utilization

```typescript
// Number of objects currently allocated
objectPool.size(); // returns 11

// Share of the pool's objects in use
objectPool.utilization(); // returns 0.11
objectPool.utilization(39); // returns 0.5, counting 39 more pending allocations

// Allocating past increaseBreakPoint grows the pool
objectPool.allocateMultiple(85); // returns array of 85 instances; pool grows from 100 to 200 objects

// Manually increase pool capacity. Capacity never passes maxSize.
objectPool.increaseCapacity(5000); // pool now holds 1000 objects
```

### Iterating allocated objects

```typescript
// Visit every allocated object without allocating. Objects are visited from
// the last slot to the first, not in allocation order, so the callback may
// release the object it was given.
objectPool.forEach((obj) => {
	if (obj.amount < 0) {
		objectPool.release(obj);
	}
}); // returns objectPool

// New array of names, one per allocated object
const names = objectPool.map((obj) => obj.name); // returns array of 96 names
```

### Releasing and resetting

```typescript
// Release objects back into pool. Each is cleaned with cleanObj().
objectPool.release(obj1!); // returns true
objectPool.releaseMultiple(objs);
objectPool.size(); // returns 85

// Objects that are not in use in this pool are ignored and left untouched
objectPool.release(obj1!); // returns false: already released
objectPool.release(new ObjectClass()); // returns false: not from this pool

// Release every allocated object. Pool capacity is kept.
objectPool.clearElements(); // returns objectPool
objectPool.size(); // returns 0

// Release every object, then shrink or refill the pool to startSize objects.
// Existing objects are reused, not reconstructed.
objectPool.reset(); // returns objectPool
```

### Serialize an object pool

`ObjectPool` has no `Byte*` subclass. Its objects are pool-owned scratch instances reset by `cleanObj()`, not items you store.

```typescript
// Returns the pool's config and object count as a JSON string. Objects are not included.
const serialized = objectPool.stringify();
```

## **`OctTree<T>`**

Point octree: the 3D counterpart of [`QuadTree`](#quadtreet). Each node splits space around its item's position into eight octants. Positions, bounds, and search points gain a `z` coordinate, and everything else behaves as in `QuadTree`, including `forEachWithinBounds()` / `forEachWithinRadius()` and the `ByteOctTree` subclass. Implements the shared `Tree` interface.

Children are indexed by octant, a bitmask: bit `1` set means x smaller than the node's x, bit `2` means y smaller, and bit `4` means z smaller. Octant `0` holds positions equal or larger on every axis.

### Octree basics

Typescript

```typescript
import {OctTree, OctTreeLocator} from '@toreda/data-structures';

interface Star {
	name: string;
	x: number;
	y: number;
	z: number;
}

const byPosition: OctTreeLocator<Star> = (star) => star;
const sky = new OctTree<Star>(byPosition, [
	{name: 'sol', x: 0, y: 0, z: 0},
	{name: 'vega', x: 5, y: 5, z: 5},
	{name: 'rigel', x: -9, y: 2, z: -3}
]);

sky.root()?.child(0)?.value()?.name; // returns 'vega'
sky.root()?.child(5)?.value()?.name; // returns 'rigel' (x and z smaller)
```

### Octree spatial search

```typescript
sky.withinBounds({minX: -1, minY: -1, minZ: -1, maxX: 6, maxY: 6, maxZ: 6}).length; // returns 2
sky.withinRadius({x: 0, y: 0, z: 0}, 9).length; // returns 2 (sol, vega)
sky.nearest({x: -7, y: 0, z: 0})?.value()?.name; // returns 'rigel'
```

## **`PriorityQueue<T>`**

Binary heap. The comparator returns `true` when `a` should be closer to the front than `b`, so `(a, b) => a < b` gives a min heap and `(a, b) => a > b` a max heap. With a strict comparator (`<` or `>`, not `<=` or `>=`), items of equal priority never swap. The heap is not stable: items of equal priority do not come out in insertion order. Every item, `null` included, goes to the comparator.

The backing array keeps its largest size, so once it has grown, `push()` and `pop()` allocate nothing.

### Priority queue basics

Typescript

```typescript
// Import
import {PriorityQueue, PriorityQueueComparator} from '@toreda/data-structures';

// Instantiate. The comparator is required and throws when it is not a function.
const minFirst: PriorityQueueComparator<number> = (a, b) => a < b;
const priorityQueue = new PriorityQueue<number>(minFirst);
const priorityQueueWithElements = new PriorityQueue<number>(minFirst, {
	elements: [5, 3, 7, 1]
});
priorityQueueWithElements.peek(); // returns 1

const maxFirst = new PriorityQueue<number>((a, b) => a > b, {elements: [5, 3, 7, 1]});
maxFirst.peek(); // returns 7

// Add elements to the queue
priorityQueue.push(20); // returns priorityQueue
priorityQueue.push(10); // returns priorityQueue

// Get number of elements in queue
priorityQueue.size(); // returns 2
priorityQueue.isEmpty(); // returns false

// Get the highest priority element without removing it
priorityQueue.peek(); // returns 10
```

### Iterating a priority queue

```typescript
// Iterate in heap order, which is not sorted order, without allocating. The
// third argument is the queue itself (like Map/Set.forEach).
priorityQueue.forEach((elem, index, queue) => {
	console.log(elem + ' is at index ' + index + ' of ' + queue.size());
}); // returns priorityQueue
// outputs '10 is at index 0 of 2'
// outputs '20 is at index 1 of 2'

// Items in heap order, as a new array
priorityQueue.values(); // returns [10, 20]
```

### Pop and reset a priority queue

```typescript
// Remove and return the highest priority element
priorityQueue.pop(); // returns 10
priorityQueue.pop(); // returns 20
priorityQueue.pop(); // returns null

// Reset priority queue and remove all elements
priorityQueue.reset(); // returns priorityQueue

// Add 3 elements via chained push calls
priorityQueue.push(30).push(10).push(20);
```

### Serialize a priority queue

```typescript
// Returns the current state of the queue as a JSON string
const serialized = priorityQueue.stringify(); // returns '{"type":"PriorityQueue","elements":[10,30,20]}'

// Byte form of the whole queue is provided by BytePriorityQueue, a superset of
// PriorityQueue. It takes an ItemCodec, then the comparator.
import {BytePriorityQueue} from '@toreda/data-structures';

const codec = {
	encode: (item: number): Uint8Array => new Uint8Array(new Float64Array([item]).buffer),
	decode: (bytes: Uint8Array): number => new Float64Array(bytes.slice().buffer)[0]
};

const source = new BytePriorityQueue<number>(codec, minFirst, [30, 10, 20]);
const bytes = source.toBytes(); // Uint8Array, items in heap order

// Rebuilds the identical heap. Throws when bytes are not a valid envelope.
const fromBytes = new BytePriorityQueue<number>(codec, minFirst, bytes);
fromBytes.peek(); // returns 10
```

## **`QuadTree<T>`**

Point quadtree over positions on a plane. Each node holds one item and splits the plane around the item's position into four quadrants, each holding a subtree of the items that lie in it. Positions are read by a locator you provide, and any finite position fits: the plane is unbounded. Implements the shared `Tree` interface.

Insert and exact position lookup take O(h), where h is the tree's height. Rectangle, radius, and nearest neighbor searches skip every quadrant that cannot hold a match. The tree is not self-balancing, so its shape depends on insertion order: well spread input gives O(log n) height, while input sorted along both axes degrades toward O(n). Removing or moving a leaf relinks nothing. Removing or moving an inner node relinks every node in its subtree, the conventional point quadtree deletion, in one pass that allocates nothing, so removing near the root costs more than removing a leaf.

Children are indexed by quadrant: `0` north-east, `1` north-west, `2` south-east, `3` south-west. North means y equal or larger, and east means x equal or larger.

### Quadtree basics

Typescript

```typescript
import {QuadTree, QuadTreeElement, QuadTreeLocator} from '@toreda/data-structures';

interface Place {
	name: string;
	x: number;
	y: number;
}

// Instantiate. The locator is required and throws when it is not a function.
// Items that already have x and y fields can be returned as is.
const byPosition: QuadTreeLocator<Place> = (place) => place;
const tree = new QuadTree<Place>(byPosition);

// Insert items. Returns the node now holding the item.
const home = tree.insert({name: 'home', x: 0, y: 0}); // root
tree.insert({name: 'park', x: 3, y: 4}); // home's north-east quadrant
tree.insert({name: 'shop', x: -2, y: 1}); // home's north-west quadrant
tree.insert({name: 'work', x: 10, y: -6}); // home's south-east quadrant

// Items without finite coordinates are refused instead of throwing
tree.insert({name: 'lost', x: NaN, y: 0}); // returns 'invalid_position'

// Exact position lookup
tree.find({x: 3, y: 4})?.value()?.name; // returns 'park'
tree.contains({x: 1, y: 1}); // returns false
```

### Quadtree spatial search

```typescript
// Rectangle search, edges included. Nodes come back in pre-order.
tree.withinBounds({minX: -5, minY: -5, maxX: 5, maxY: 5}).map((node) => node.value()?.name);
// returns ['home', 'park', 'shop']

// Radius search, boundary included
tree.withinRadius({x: 0, y: 0}, 3).map((node) => node.value()?.name); // returns ['home', 'shop']

// Nearest neighbor. Allocates nothing.
tree.nearest({x: 9, y: -5})?.value()?.name; // returns 'work'

// Per-frame queries: visit matches without allocating. Define the callback
// once, outside the frame loop. It receives (node, index, tree).
let nearby = 0;
const countHit = (node: QuadTreeElement<Place>): void => {
	nearby++;
};
tree.forEachWithinRadius({x: 0, y: 0}, 3, countHit); // visits home, then shop; nearby is 2
tree.forEachWithinBounds({minX: -5, minY: -5, maxX: 5, maxY: 5}, countHit); // nearby is 5

// Or pass an array to refill. Its storage is reused while the match count
// stays the same, but V8 shrinks it when the count drops, so a later larger
// result can allocate again. The forEachWithin* visitors never allocate.
const found: QuadTreeElement<Place>[] = [];
tree.withinRadius({x: 0, y: 0}, 3, found); // returns found, holding home and shop
```

The visitors are safe under mutation, with the same rules as `forEach`: matches are collected before the callback first runs, a match removed before it is reached is skipped, and inserted items are not visited.

### Moving and removing quadtree items

```typescript
// Nodes store the position their item was filed under. After moving an item
// in place, call update() to move its node. The same node keeps the item.
const park = tree.find({x: 3, y: 4})!;
park.value()!.x = 20;
tree.update(park, park.value()!); // returns park
tree.find({x: 20, y: 4}) === park; // true

// Remove matches the item itself, like Set.prototype.delete
tree.remove(park.value()!); // returns the park item
```

### Quadtree traversal and shared features

```typescript
// Traversal: pre-order is the default for values(), iteration, forEach, and query
tree.values().map((place) => place.name); // returns ['home', 'shop', 'work']
tree.stringify(); // returns '{"type":"QuadTree","elements":[...]}' with items in pre-order

// Byte form of the whole tree is provided by ByteQuadTree, a superset of
// QuadTree. It takes an ItemCodec, then the locator. Items are encoded in
// pre-order, so rebuilding from the bytes gives the same tree shape.
import {ByteQuadTree} from '@toreda/data-structures';

const placeCodec = {
	encode: (place: Place): Uint8Array => new TextEncoder().encode(JSON.stringify(place)),
	decode: (bytes: Uint8Array): Place => JSON.parse(new TextDecoder().decode(bytes))
};

const source = new ByteQuadTree<Place>(placeCodec, byPosition, tree.values());
const fromBytes = new ByteQuadTree<Place>(placeCodec, byPosition, source.toBytes());
fromBytes.size(); // returns 3
```

Node pooling, `filter`, `query`, `forEach`, `preOrder`, `postOrder`, `levelOrder`, and the `allowDuplicates` option work as in [`BinarySearchTree`](#binarysearchtreet). A quadtree has no sorted order, so there is no `inOrder()`, `min()`, or `max()`, and walks run in pre-order. Duplicates are items at exactly the same position. With `allowDuplicates: false`, inserting at an occupied position returns `'duplicate_not_allowed'` and adds nothing.

## `Queue<T>`

First in, first out, backed by a growable ring buffer. `pop()` is O(1). `push()` is amortized O(1): a push into a full buffer doubles it and copies every item, which is O(n). Once the buffer has grown to the queue's largest size, `push()` and `pop()` allocate nothing. Every traversal runs from the front to the rear.

### Queue basics

Typescript

```typescript
// Import
import {Queue} from '@toreda/data-structures';

// Instantiate
const myQueue = new Queue<string>();
// Instantiate with starting elements, listed front to rear
const myQueueWithElements = new Queue<string>({elements: ['a', 'b', 'c']});
myQueueWithElements.front(); // returns 'a'

// Add elements to the rear of the queue
myQueue.push('my string 1'); // returns myQueue
myQueue.push('my string 2'); // returns myQueue

// Get queue size
myQueue.size(); // returns 2
myQueue.isEmpty(); // returns false

// Read elements without removing them
myQueue.front(); // returns 'my string 1'
myQueue.peek(); // alias of front(), returns 'my string 1'
myQueue.rear(); // returns 'my string 2'
myQueue.back(); // alias of rear(), returns 'my string 2'
myQueue.at(1); // returns 'my string 2'
myQueue.at(-1); // returns 'my string 2'; negative positions count back from the rear
myQueue.at(2); // returns null
```

### Iterating a queue

```typescript
// Iterate from front to rear without allocating. The third argument is the
// queue itself (like Map/Set.forEach).
myQueue.forEach((elem, index, queue) => {
	console.log(elem + ' is at index ' + index + ' of ' + queue.size());
}); // returns myQueue
// outputs 'my string 1 is at index 0 of 2'
// outputs 'my string 2 is at index 1 of 2'

for (const elem of myQueue) {
	console.log(elem); // outputs 'my string 1', then 'my string 2'
}
```

### Pop and reverse a queue

```typescript
// Remove and return the front element
myQueue.pop(); // returns 'my string 1'
myQueue.pop(); // returns 'my string 2'
myQueue.pop(); // returns null because myQueue is already empty

// Queue 3 items via chained push calls
myQueue.push('one').push('two').push('three');

// Reverse the order of queued elements.
// Front to rear 'one', 'two', 'three' becomes 'three', 'two', 'one'.
myQueue.reverse(); // returns myQueue
```

### Serialize and reset a queue

```typescript
// Returns the current state of the queue as a JSON string
const serialized = myQueue.stringify(); // returns '{"type":"Queue","elements":["three","two","one"]}'

// Reset queue and remove all elements. The buffer's capacity is kept.
myQueue.reset(); // returns myQueue

// Byte form of the whole queue is provided by ByteQueue, a superset of Queue.
// Items are generic, so it requires an ItemCodec at construction.
import {ByteQueue} from '@toreda/data-structures';

const codec = {
	encode: (item: string): Uint8Array => new TextEncoder().encode(item),
	decode: (bytes: Uint8Array): string => new TextDecoder().decode(bytes)
};

const source = new ByteQueue<string>(codec, ['a', 'b']);
const bytes = source.toBytes(); // Uint8Array, items front to rear

// Rebuild a queue from envelope bytes. Throws when bytes are not a valid envelope.
const fromBytes = new ByteQueue<string>(codec, bytes);
fromBytes.front(); // returns 'a'
```

## **`RedBlackTree<T>`**

Self-balancing binary search tree ordered by a comparator you provide. Insert and removal recolor and rotate nodes so the tree's height never exceeds 2 log2(n + 1), whatever order items arrive in. Search, insert, and removal take O(log n) in the worst case, including for items inserted already sorted. Implements the shared `Tree` interface.

`RedBlackTree` has the same API as [`BinarySearchTree`](#binarysearchtreet): `insert`, `find`, `remove`, `update`, `min`, `max`, `successor`, `predecessor`, every traversal order, `filter`, `query`, the `allowDuplicates` option, and node pooling all behave the same way. It adds node colors and `blackHeight()`.

### Balancing sorted input

Typescript

```typescript
import {RedBlackTree, RedBlackTreeComparator} from '@toreda/data-structures';

// Instantiate. The comparator is required and throws when it is not a function.
const byNumber: RedBlackTreeComparator<number> = (a, b) => a - b;
const tree = new RedBlackTree<number>(byNumber);

// Sorted input stays balanced. A BinarySearchTree would have height 999 here.
for (let i = 0; i < 1000; i++) {
	tree.insert(i);
}
tree.height(); // returns 16 (never more than 2 log2(n + 1))
```

### Node colors and black height

```typescript
// Nodes expose their color
const small = new RedBlackTree<number>(byNumber, [20, 10, 30]);
//         20 (black)
//        /    \
//   10 (red)  30 (red)
small.root()?.color(); // returns 'black'
small.root()?.left()?.color(); // returns 'red'

// Black nodes on every path from the root down to a missing child
small.blackHeight(); // returns 1

// Everything else works as in BinarySearchTree
small.remove(10); // returns 10
small.values(); // returns [20, 30]
small.stringify(); // returns '{"type":"RedBlackTree","elements":[20,30]}'
```

`ByteRedBlackTree` is the byte form, with the same `(codec, comparator, data?, options?)` constructor as `ByteBinarySearchTree`. Items are encoded in sorted order.

### Red-black tree duplicates

Equal items keep their insertion order in every sorted walk, and `find()` and `remove()` act on the earliest one, as in `BinarySearchTree`. Rotations can move an equal item into a node's left subtree, so a left subtree holds equal or smaller items here instead of strictly smaller ones. This only matters when walking nodes by hand.

## **`SpatialHash<T>`**

Uniform grid spatial hash. Space is cut into cubic cells of `cellSize`, and each item is filed under the cell holding the position your locator returns. Any number of items can share a cell. Only occupied cells take memory, so there are no world bounds to set up front. For at most one item per cell, use [`SpatialMap`](#spatialmapt).

Insert, remove, and `update()` are O(1) on average however far an item moves, which suits items that all move every frame. Positions, bounds, and search points use the same shapes as `OctTree`, typed `SpatialPoint` and `SpatialBounds`. For 2D, return `0` for `z`. The `ByteSpatialHash` subclass encodes the hash to bytes.

Iteration, `values()`, `toArray()`, `query()`, and `stringify()` follow insertion order. Spatial searches return matches in cell order, which is unspecified.

### Spatial hash basics

```typescript
import {SpatialHash, SpatialLocator} from '@toreda/data-structures';

interface Ship {
	name: string;
	x: number;
	y: number;
	z: number;
}

const byPosition: SpatialLocator<Ship> = (ship) => ship;
const ships = new SpatialHash<Ship>(
	byPosition,
	[
		{name: 'scout', x: 10, y: 0, z: 0},
		{name: 'hauler', x: 40, y: 5, z: 0},
		{name: 'raider', x: 900, y: 0, z: 0}
	],
	{cellSize: 50}
);

ships.size(); // returns 3
ships.cellCount(); // returns 2 (scout and hauler share cell 0, 0, 0)
ships.withinRadius({x: 0, y: 0, z: 0}, 45).length; // returns 2 (scout, hauler)
ships.nearest({x: 700, y: 0, z: 0})?.value()?.name; // returns 'raider'
ships.find({x: 10, y: 0, z: 0})?.value()?.name; // returns 'scout' (exact position)
```

`insert()` returns the element holding the item, or the `invalid_position` error code when the locator doesn't return finite coordinates. `withinBounds()` and `withinRadius()` take an optional array to refill. `forEachWithinBounds()` and `forEachWithinRadius()` visit matches without allocating, and are safe to call when the callback inserts, removes, or moves items:

```typescript
ships.forEachWithinRadius({x: 0, y: 0, z: 0}, 100, (element, index, hash) => {
	// Runs once per ship in range, allocating nothing.
});
```

### Moving spatial hash items

The hash stores the position each item was filed under, so it can't see an item move. After changing anything the locator reads, pass the element and item to `update()`. It keeps the same element, and only relinks when the item changes cell:

```typescript
const scout = ships.find({x: 10, y: 0, z: 0})!;
const ship = scout.value()!;

ship.x = 950;
ships.update(scout, ship); // returns scout
scout.cellX(); // returns 19
ships.withinRadius({x: 925, y: 0, z: 0}, 30).length; // returns 2 (raider, scout)
```

`remove(item)` searches the cell of the item's current locator position, so call `update()` before removing an item that has moved, or use `removeNode()`.

### Choosing a cell size

Searches probe every cell overlapping the search region, then test each item in those cells.

* **Near your typical search radius** is a good default. A radius search then probes at most 27 cells.
* **Much smaller cells** make each search probe many empty cells.
* **Much larger cells** make each probe test many items that are out of range.

`cellSize` defaults to `1`. `expectedCellCount` (default `64`) sizes the cell table up front. The table grows past it on demand, so set it only to avoid growth when you know the eventual cell count. Cell coordinates are 32-bit integers, so positions more than about 2.1 billion cells from the origin are refused with `invalid_position`.

## **`SpatialMap<T>`**

Sparse uniform grid holding at most one item per cell, for grids sized so each cell fits one item: blocks, voxels, tiles, chunks, and occupancy checks for collision. Cells work as map keys, so the item in a cell is found in O(1) on average, either by a position inside it with `find()` or by integer cell coordinates with `findCell()`.

Everything else matches [`SpatialHash`](#spatialhasht): the locator, `cellSize`, spatial searches, `nearest()`, `update()`, pooling, iteration in insertion order, and the `ByteSpatialMap` subclass. `size()` is also the number of occupied cells.

### Spatial map basics

```typescript
import {SpatialMap, SpatialLocator} from '@toreda/data-structures';

interface Block {
	type: string;
	x: number;
	y: number;
	z: number;
}

const byPosition: SpatialLocator<Block> = (block) => block;
const blocks = new SpatialMap<Block>(byPosition);

blocks.insert({type: 'stone', x: 0, y: 0, z: 0}); // returns the element
blocks.insert({type: 'dirt', x: 0.5, y: 0.2, z: 0.9}); // returns 'cell_occupied'
blocks.insert({type: 'dirt', x: 1, y: 0, z: 0}); // returns the element

blocks.findCell(1, 0, 0)?.value()?.type; // returns 'dirt'
blocks.containsCell(0, 1, 0); // returns false
blocks.find({x: 0.7, y: 0.7, z: 0.7})?.value()?.type; // returns 'stone'
```

Cell `(cx, cy, cz)` holds positions whose `floor(x / cellSize)`, `floor(y / cellSize)`, and `floor(z / cellSize)` equal those coordinates. Each element reports its cell with `cellX()`, `cellY()`, and `cellZ()`, so neighbors are one step away on each axis:

```typescript
const chunks = new SpatialMap<Block>(byPosition, null, {cellSize: 16});

chunks.insert({type: 'chunk', x: 40, y: -3, z: 100});
chunks.findCell(2, -1, 6)?.value()?.type; // returns 'chunk'
```

### Collisions and overwrite

Occupancy is decided by cell, not exact position: two items at different positions in one cell collide. By default an item arriving at an occupied cell is refused with `cell_occupied`. A refused `update()` changes nothing, so it doubles as a collision check:

```typescript
const stone = blocks.findCell(0, 0, 0)!;

blocks.update(stone, {...stone.value()!, x: 1.5}); // returns 'cell_occupied', nothing moves
blocks.update(stone, {...stone.value()!, y: 1}); // returns stone, now in cell 0, 1, 0
```

When an item was changed in place and its move is refused, the item's locator position no longer matches its element. Restore its position, or remove it with `removeNode()`, since `remove()` searches by the locator's position.

With `overwrite: true`, an arriving item replaces the occupant instead, like `Map.prototype.set()`:

```typescript
const latest = new SpatialMap<Block>(byPosition, null, {overwrite: true});

latest.insert({type: 'stone', x: 0, y: 0, z: 0});
latest.insert({type: 'glass', x: 0.5, y: 0.5, z: 0.5}); // replaces stone
latest.size(); // returns 1
```

## `Stack<T>`

Last in, first out. The backing array keeps its largest size, so once it has grown, `push()` and `pop()` allocate nothing. Every traversal (`forEach`, iteration, `at`, query `index()`) runs from the top down, and position 0 is the top.

### Stack basics

Typescript

```typescript
// Import
import {Stack} from '@toreda/data-structures';

// Instantiate
const myStack = new Stack<string>();
// Instantiate with starting elements, listed bottom to top
const myStackWithElements = new Stack<string>({elements: ['a', 'b', 'c']});
myStackWithElements.top(); // returns 'c'

// Push elements onto the top of the stack
myStack.push('my string 1'); // returns myStack
myStack.push('my string 2'); // returns myStack

// Get stack size
myStack.size(); // returns 2
myStack.isEmpty(); // returns false

// Read elements without removing them
myStack.top(); // returns 'my string 2'
myStack.peek(); // alias of top(), returns 'my string 2'
myStack.bottom(); // returns 'my string 1'
myStack.at(0); // returns 'my string 2'
myStack.at(1); // returns 'my string 1'
myStack.at(2); // returns null
```

### Iterating a stack

```typescript
// Iterate from top to bottom without allocating. The third argument is the
// stack itself (like Map/Set.forEach).
myStack.forEach((elem, index, stack) => {
	console.log(elem + ' is at index ' + index + ' of ' + stack.size());
}); // returns myStack
// outputs 'my string 2 is at index 0 of 2'
// outputs 'my string 1 is at index 1 of 2'

for (const elem of myStack) {
	console.log(elem); // outputs 'my string 2', then 'my string 1'
}
```

### Pop and reverse a stack

```typescript
// Remove and return the top element
myStack.pop(); // returns 'my string 2'
myStack.pop(); // returns 'my string 1'
myStack.pop(); // returns null because myStack is already empty

// Push 3 items via chained push calls
myStack.push('one').push('two').push('three');

// Reverse the order of stack elements.
// Top to bottom 'three', 'two', 'one' becomes 'one', 'two', 'three'.
myStack.reverse(); // returns myStack
```

### Serialize and reset a stack

```typescript
// Returns the current state of the stack as a JSON string
const serialized = myStack.stringify(); // returns '{"type":"Stack","elements":["three","two","one"]}'

// Reset stack and remove all elements. The backing array's capacity is kept.
myStack.reset(); // returns myStack

// Byte form of the whole stack is provided by ByteStack, a superset of Stack.
// Items are generic, so it requires an ItemCodec at construction.
import {ByteStack} from '@toreda/data-structures';

const codec = {
	encode: (item: string): Uint8Array => new TextEncoder().encode(item),
	decode: (bytes: Uint8Array): string => new TextDecoder().decode(bytes)
};

// Array items are pushed bottom to top
const source = new ByteStack<string>(codec, ['a', 'b']);
const bytes = source.toBytes(); // Uint8Array, items top to bottom

// Rebuild a stack from envelope bytes. Throws when bytes are not a valid envelope.
const fromBytes = new ByteStack<string>(codec, bytes);
fromBytes.top(); // returns 'b'
```

## **`Trie<T>`**

Prefix tree mapping string keys to items. Each key is stored as a path of nodes from the root, one node per UTF-16 code unit, so keys sharing a prefix share the nodes for it. Insert, find, and removal take time proportional to the key's length, not the number of items, and prefix searches only visit nodes below the prefix. Keys are unique: inserting an item under a stored key replaces the stored item, like `Map.prototype.set()`.

A key selector that reads each item's key is required, as a comparator is for `BinarySearchTree`. Items are kept in key order: ascending by UTF-16 code unit, the order of `Array.prototype.sort()` without a comparator.

### Trie basics

Typescript

```typescript
import {Trie} from '@toreda/data-structures';

// Instantiate. For string items, the key selector returns the item itself.
// Throws when the key selector is not a function.
const words = new Trie<string>((word) => word, ['car', 'cart', 'cat']);

words.insert('care'); // returns the node now holding 'care'
words.size(); // returns 4

// Look up whole keys
words.contains('car'); // returns true
words.contains('ca'); // returns false, 'ca' is only a prefix
words.get('cat'); // returns 'cat'
words.find('cart')?.key(); // returns 'cart'

// Remove by key
words.remove('cart'); // returns 'cart'
words.remove('dog'); // returns null

// Items without a string key are refused instead of throwing
new Trie<any>((item) => item).insert(42); // returns 'invalid_key'
```

### Prefix search and autocomplete

```typescript
const dictionary = new Trie<string>((word) => word, ['she', 'sells', 'sea', 'shells', 'shore']);

dictionary.hasPrefix('sh'); // returns true
dictionary.keysWithPrefix('sh'); // returns ['she', 'shells', 'shore']

// Nodes instead of keys. Pass an array to refill instead of allocating a new one.
const matches = dictionary.withPrefix('se'); // nodes holding 'sea', 'sells'

// Visit matches without allocating
dictionary.forEachWithPrefix('sh', (node, index, trie) => {
	console.log(node.key()); // outputs 'she', then 'shells', then 'shore'
});

// Longest stored key at the start of some text, e.g. for tokenizing
dictionary.longestPrefixOf('shellsort')?.key(); // returns 'shells'
```

### Objects keyed by string

```typescript
interface Command {
	name: string;
	run: () => void;
}

const commands = new Trie<Command>((command) => command.name);
const node = commands.insert({name: 'build', run: () => {}});

// A stored key's item is replaced, and the node stays the same
commands.insert({name: 'build', run: () => {}}); // returns the same node
commands.size(); // returns 1

// After changing a key in place, call update() so the item moves to its new key.
// A node stands for a key, so use the returned node from then on.
const command = commands.get('build')!;
command.name = 'bundle';
const moved = commands.update(commands.find('build'), command);
commands.get('bundle'); // returns command
```

### Trie traversal and shared features

```typescript
const trie = new Trie<string>((word) => word, ['b', 'a', 'ab']);

trie.keys(); // returns ['a', 'ab', 'b']
trie.values(); // returns ['a', 'ab', 'b']
[...trie]; // same items, in key order

// Walk nodes in key order
trie.min()?.key(); // returns 'a'
trie.max()?.key(); // returns 'b'
trie.successor(trie.min())?.key(); // returns 'ab'

// Walk the node structure by hand. The root stands for the empty prefix.
trie.root().child('a')?.child('b')?.key(); // returns 'ab'

// Filter, query, and serialize work as in the other collections.
// Each query result's key() returns the matched item's key.
trie.query((item) => item.length > 1)[0].key(); // returns 'ab'
trie.filter((node) => node.key() !== 'b').keys(); // returns ['a', 'ab']
trie.stringify(); // returns '{"type":"Trie","elements":["a","ab","b"]}'

// Byte form of the whole trie is provided by ByteTrie, a superset of Trie.
// Items are generic, so it requires an ItemCodec at construction.
import {ByteTrie} from '@toreda/data-structures';

const codec = {
	encode: (item: string): Uint8Array => new TextEncoder().encode(item),
	decode: (bytes: Uint8Array): string => new TextDecoder().decode(bytes)
};

const source = new ByteTrie<string>(codec, (word) => word, ['b', 'a', 'ab']);
const bytes = source.toBytes(); // Uint8Array, items in key order

// Rebuild a trie from envelope bytes. Throws when bytes are not a valid envelope.
const fromBytes = new ByteTrie<string>(codec, (word) => word, bytes);
fromBytes.keys(); // returns ['a', 'ab', 'b']
```

Node wrappers are pooled by default, as in [`LinkedList`](#linked-list-node-pooling). The root node belongs to the trie for its lifetime and is never pooled. Removing an item unlinks the nodes that no longer lead to any key, so don't keep using a node after removing its item.

# Query Selectors

Every collection supports `query()`. A query takes one filter, or an array of filters that must all match, and returns one `QueryResult` per match. Each result holds the matched `element` and offers `index()`, `key()`, and `delete()`.

Typescript

```typescript
import {QueryFilter, QueryOptions, QueryResult} from '@toreda/data-structures';
import {BinarySearchTree, CircularQueue, LinkedList, PriorityQueue, Queue, Stack} from '@toreda/data-structures';

const myQueue = new Queue<number>();
const myStack = new Stack<number>();
const myLinkedList = new LinkedList<number>();
const myCircularQueue = new CircularQueue<number>();
const myPriorityQueue = new PriorityQueue<number>((a, b) => a < b);
const myTree = new BinarySearchTree<number>((a, b) => a - b);

// Create a query filter function
const basicQueryFilter: QueryFilter<number> = (value) => {
	return value === 30;
};

// Create a query filter function generator
const genQueryFilter = (target: number, lessThan: boolean): QueryFilter<number> => {
	return (value) => (lessThan ? value < target : value > target);
};

// Add elements to all data structures
[10, 20, 30, 40, 50].forEach((value) => {
	myQueue.push(value);
	myStack.push(value);
	myLinkedList.insert(value);
	myCircularQueue.push(value);
	myPriorityQueue.push(value);
	myTree.insert(value);
});

// Use a query filter to get query results
const resultsQueue = myQueue.query(basicQueryFilter); // returns array of query result objects
const resultsStack = myStack.query(basicQueryFilter);
const resultsLinkedList = myLinkedList.query(basicQueryFilter);
const resultsCircularQueue = myCircularQueue.query(basicQueryFilter);
const resultsPriorityQueue = myPriorityQueue.query(basicQueryFilter);
const resultsTree = myTree.query(basicQueryFilter);

// Get the element in query result. Node-based data structures return the node.
resultsQueue[0].element; // returns 30
resultsStack[0].element; // returns 30
resultsLinkedList[0].element.value(); // returns 30
resultsCircularQueue[0].element; // returns 30
resultsPriorityQueue[0].element; // returns 30
resultsTree[0].element.value(); // returns 30

// Get the current index of the query result
resultsQueue[0].index(); // returns 2 (position from the front)
resultsStack[0].index(); // returns 2 (position down from the top)
resultsLinkedList[0].index(); // returns null (lists have no index)
resultsCircularQueue[0].index(); // returns 2 (position from the front)
resultsPriorityQueue[0].index(); // returns 2 (position in the heap array)
resultsTree[0].index(); // returns null (trees have no index)

myQueue.pop(); // removes 10
myStack.pop(); // returns 50
myLinkedList.removeNode(myLinkedList.head()); // returns 10
myCircularQueue.pop(); // returns 10
myPriorityQueue.pop(); // returns 10

// index() is computed when called, so it follows later changes
resultsQueue[0].index(); // returns 1
resultsStack[0].index(); // returns 1
resultsLinkedList[0].index(); // returns null
resultsCircularQueue[0].index(); // returns 1
resultsPriorityQueue[0].index(); // returns 2

// Delete query result from original data structure. Returns the removed item.
resultsQueue[0].delete(); // returns 30
resultsStack[0].delete(); // returns 30
resultsLinkedList[0].delete(); // returns 30
resultsCircularQueue[0].delete(); // returns 30
resultsPriorityQueue[0].delete(); // returns 30
resultsTree[0].delete(); // returns 30

// Deleting again returns null because the item is no longer present
resultsQueue[0].delete(); // returns null

// Use multiple query filters and query options
myQueue.reset();
myQueue.push(10).push(20).push(30).push(40).push(50);

const filters: QueryFilter<number>[] = [];
filters.push(genQueryFilter(10, false)); // value > 10
filters.push(genQueryFilter(50, true)); // value < 50

const options: QueryOptions = {limit: 2};
const queryResults: QueryResult<number>[] = myQueue.query(filters, options);
queryResults[0].element; // returns 20
queryResults[1].element; // returns 30
```

# Validation Helpers

Functions for reading loosely typed input, such as options objects, parsed JSON, or query strings. Each returns the first of its `values` that has the expected type, or `fallback` when none does. Numbers must be finite, so `NaN` and `±Infinity` are skipped.

```typescript
import {
	booleanNullValue,
	booleanValue,
	intNullValue,
	intValue,
	numberNullValue,
	numberValue,
	typeValue
} from '@toreda/data-structures';

intValue(10, '5', 3.5, 7); // returns 7 ('5' is a string and 3.5 is not an integer)
numberValue(0, 'x', NaN, Infinity, 2.5); // returns 2.5
booleanValue(false, 'true', 1, true); // returns true
booleanNullValue(null, 0, false); // returns false

// The *NullValue variants accept a null fallback
intNullValue(null, 'x', 1.5); // returns null
numberNullValue(null); // returns null

// typeValue takes your own type guard
const isString = (value: unknown): value is string => typeof value === 'string';
typeValue(isString, 'default', 1, 'a'); // returns 'a'
typeValue(isString, 'default', 1); // returns 'default'
```

# Development

Clone the repo, move into its root folder, and install its dependencies with pnpm:

```bash
git clone https://github.com/toreda/data-structures.git
cd data-structures
pnpm install
```

| Command | What it does |
|---|---|
| `pnpm build` | Lints, then builds `dist/cjs` and `dist/esm` |
| `pnpm test` | Runs the Jest suite with coverage |
| `pnpm bench` | Runs the [allocation benchmark](#allocation-benchmark) (build first) |
| `pnpm make:docs` | Generates the API reference into `docs/` |

# License

[MIT](LICENSE.md) &copy; Toreda, Inc.
