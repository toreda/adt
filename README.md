[![Toreda](https://content.toreda.com/logo/toreda-logo.png)](https://www.toreda.com)

[![GitHub package.json version (branch)](https://img.shields.io/github/package-json/v/toreda/adt/master?style=for-the-badge)](https://github.com/toreda/adt/releases/latest) [![GitHub Release Date](https://img.shields.io/github/release-date/toreda/adt?style=for-the-badge)](https://github.com/toreda/adt/releases/latest) [![GitHub issues](https://img.shields.io/github/issues/toreda/adt?style=for-the-badge)](https://github.com/toreda/adt/issues)

[![GitHub](https://img.shields.io/github/stars/toreda/adt?style=for-the-badge&logo=github&label=GitHub)](https://github.com/toreda/adt) [![NPM Downloads](https://img.shields.io/npm/dm/@toreda/adt?style=for-the-badge&logo=npm&label=NPM)](https://www.npmjs.com/package/@toreda/adt) [![license](https://img.shields.io/github/license/toreda/adt?style=for-the-badge)](https://github.com/toreda/adt/blob/master/LICENSE.md)

# `@toreda/adt` Abstract Data Types

Collection of TypeScript generic data structures with consistent APIs for search, insertion, and deletion.

# Contents
- [`@toreda/adt` Abstract Data Types](#toredaadt-abstract-data-types)
- [Contents](#contents)
- [**`ADT` Interface**](#adt-interface)
- [Data Structures](#data-structures)
	- [`Stack<T>`](#stackt)
	- [`Queue<T>`](#queuet)
	- [`LinkedList<T>`](#linkedlistt)
	- [**`CircularQueue<T>`**](#circularqueuet)
	- [**`PriorityQueue<T>`**](#priorityqueuet)
	- [**`ObjectPool<T>`**](#objectpoolt)
	- [**`BinarySearchTree<T>`**](#binarysearchtreet)
		- [Basics](#basics)
		- [Traversal and iteration](#traversal-and-iteration)
		- [Objects ordered by key](#objects-ordered-by-key)
		- [Updating items after insertion](#updating-items-after-insertion)
		- [Duplicates](#duplicates)
		- [Filter, query, and serialize](#filter-query-and-serialize)
		- [Node pooling](#node-pooling)
- [Query Selectors](#query-selectors)
- [Install](#install)
		- [Install using pnpm](#install-using-pnpm)
- [License](#license)

# **`ADT` Interface**
Every collection is generic over its item type and implements the `ADT` interface:

```typescript
interface ADT<ItemT> {
	clearElements(): void;
	reset(): void;
	stringify(): string | null;
	query(
		query: QueryFilter<ItemT> | QueryFilter<ItemT>[],
		options?: QueryOptions
	): QueryResult<ItemT>[] | QueryResult<Element<ItemT>, ItemT>[];
}
```

Node-based collections (`LinkedList`, `BinarySearchTree`) wrap each item in an element that implements `Element<T>`, whose `value()` reads the item. Tree collections also implement the shared `Tree` interface.

Methods return `null` instead of throwing when a collection is empty or holds no matching item, for example `pop()` on an empty `Stack`.

# Data Structures

* [`Stack`](#stackt)
* [`Queue`](#queuet)
* [`LinkedList`](#linkedlistt)
* [`CircularQueue`](#circularqueuet)
* [`PriorityQueue`](#priorityqueuet)
* [`ObjectPool`](#objectpoolt)
* [`BinarySearchTree`](#binarysearchtreet)

## `Stack<T>`

Last in, first out. Every traversal (`forEach`, iteration, `at`, query `index()`) runs from the top down, and position 0 is the top.

Typescript

```typescript
// Import
import {Stack} from '@toreda/adt';

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

// Iterate from top to bottom. arr is a top-first copy of the elements.
myStack.forEach((elem, index, arr) => {
	console.log(elem + ' is at index ' + index + ' in array ' + JSON.stringify(arr));
}); // returns myStack
// outputs 'my string 2 is at index 0 in array ["my string 2","my string 1"]'
// outputs 'my string 1 is at index 1 in array ["my string 2","my string 1"]'

for (const elem of myStack) {
	console.log(elem); // outputs 'my string 2', then 'my string 1'
}

// Remove and return the top element
myStack.pop(); // returns 'my string 2'
myStack.pop(); // returns 'my string 1'
myStack.pop(); // returns null because myStack is already empty

// Push 3 items via chained push calls
myStack.push('one').push('two').push('three');

// Reverse the order of stack elements.
// Top to bottom 'three', 'two', 'one' becomes 'one', 'two', 'three'.
myStack.reverse(); // returns myStack

// Returns the current state of the stack as a JSON string
const serialized = myStack.stringify(); // returns '{"type":"Stack","elements":["three","two","one"]}'

// Instantiate a stack using serialized state
const serialStack = new Stack<string>({serializedState: serialized!});
serialStack.top(); // returns 'one'

// Reset stack and remove all elements
myStack.reset(); // returns myStack
```


## `Queue<T>`

First in, first out. Every traversal runs from the front to the rear.

Typescript

```typescript
// Import
import {Queue} from '@toreda/adt';

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
myQueue.at(2); // returns null

// Iterate from front to rear
myQueue.forEach((elem, index, arr) => {
	console.log(elem + ' is at index ' + index + ' in array ' + JSON.stringify(arr));
}); // returns myQueue
// outputs 'my string 1 is at index 0 in array ["my string 1","my string 2"]'
// outputs 'my string 2 is at index 1 in array ["my string 1","my string 2"]'

for (const elem of myQueue) {
	console.log(elem); // outputs 'my string 1', then 'my string 2'
}

// Remove the front element. pop() returns the queue, not the removed
// element, so read the element with front() before popping it.
const first = myQueue.front(); // returns 'my string 1'
myQueue.pop(); // returns myQueue
myQueue.front(); // returns 'my string 2'
myQueue.pop().size(); // returns 0
myQueue.pop(); // returns myQueue and does nothing because myQueue is already empty

// Queue 3 items via chained push calls
myQueue.push('one').push('two').push('three');

// Reverse the order of queued elements.
// Front to rear 'one', 'two', 'three' becomes 'three', 'two', 'one'.
myQueue.reverse(); // returns myQueue

// Returns the current state of the queue as a JSON string
const serialized = myQueue.stringify(); // returns '{"type":"Queue","elements":["three","two","one"]}'

// Instantiate a queue using serialized state
const serialQueue = new Queue<string>({serializedState: serialized});
serialQueue.front(); // returns 'three'

// Reset queue and remove all elements
myQueue.reset(); // returns myQueue
```

## `LinkedList<T>`

Doubly linked list. Each item is wrapped in a `LinkedListElement` node with `prev()` and `next()` links. Removing a node takes O(1).

Typescript

```typescript
// Import
import {LinkedList} from '@toreda/adt';

// Instantiate
const myLinkedList = new LinkedList<string>();
// Instantiate with starting elements, inserted head to tail
const myLinkedListWithElements = new LinkedList<string>(['a', 'b', 'c']);
// Node wrappers are pooled and recycled by default. Only strict `true` turns it off.
// With pooling on, a node is invalid once removed from the list; use removeNode's return value.
const myUnpooledLinkedList = new LinkedList<string>([], {disableElementPooling: true});
// Tune the internal pool with ObjectPool options. Omitted entries keep the list's defaults.
const myTunedLinkedList = new LinkedList<string>([], {pool: {startSize: 64, maxSize: 4096}});

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

// Returns list values as a JSON string
const serialized = myLinkedList.stringify(); // returns '{"type":"LinkedList","elements":["three","two","one"]}'

// Byte form of the whole list is provided by ByteLinkedList, a superset of
// LinkedList. Items are generic, so it requires an ItemCodec at construction.
import {ByteLinkedList} from '@toreda/adt';

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


## **`CircularQueue<T>`**

Fixed capacity queue backed by a ring buffer. Only the `maxSize` (default `25`) and `overwrite` (default `false`) options are read; the other entries in `CircularQueueOptions` are currently ignored.

Typescript

```typescript
// Import
import {CircularQueue} from '@toreda/adt';

// Instantiate
const circularQueueDefault = new CircularQueue<number>(); // maxSize 25, overwrite false
const circularQueueWithOptions = new CircularQueue<number>({
	maxSize: 999,
	overwrite: true
});

// Use as Queue
const circularQueue = new CircularQueue<number>({
	maxSize: 4
});

// Add elements to the rear of the queue. Returns false once the queue is full.
circularQueue.push(10); // returns true
circularQueue.push(20); // returns true
circularQueue.push(30); // returns true
circularQueue.push(40); // returns true
circularQueue.push(50); // returns false

// Get queue size
circularQueue.size(); // returns 4
circularQueue.isFull(); // returns true

// Get first element added to queue
circularQueue.front(); // returns 10
circularQueue.peek(); // alias of front(), returns 10

// Get last element added to queue
circularQueue.rear(); // returns 40

// Get nth-after-first element added to queue
circularQueue.getIndex(1); // returns 20
circularQueue.getIndex(2); // returns 30

// Get nth-to-last element added to queue
circularQueue.getIndex(-1); // returns 40
circularQueue.getIndex(-2); // returns 30

// Remove element from the front of the queue
circularQueue.pop(); // returns 10
circularQueue.pop(); // returns 20
circularQueue.size(); // returns 2
circularQueue.pop(); // returns 30
circularQueue.pop(); // returns 40
circularQueue.size(); // returns 0
circularQueue.pop(); // returns null

// push and insertFront accept several elements at once
circularQueue.push(1, 2, 3); // returns true
circularQueue.insertFront(0); // returns true; queue is now 0, 1, 2, 3
circularQueue.push(9); // returns false because the queue is full

// Remove all elements from the queue
circularQueue.clearElements(); // returns circularQueue

// Use as Buffer. When full, each push overwrites the oldest element.
const circularBuffer = new CircularQueue<number>({
	maxSize: 4,
	overwrite: true
});

// Add element to the buffer
circularBuffer.push(10); // returns true
circularBuffer.push(20); // returns true
circularBuffer.push(30); // returns true
circularBuffer.push(40); // returns true
circularBuffer.push(50); // returns true and overwrites 10

// Get buffer size
circularBuffer.size(); // returns 4

// Get first element in buffer
circularBuffer.front(); // returns 20

// Get last element added to buffer
circularBuffer.rear(); // returns 50

// Get nth-after-first element in buffer
circularBuffer.getIndex(1); // returns 30
circularBuffer.getIndex(2); // returns 40

// Get nth-to-last element added to buffer
circularBuffer.getIndex(-1); // returns 50
circularBuffer.getIndex(-2); // returns 40

// Remove element from the buffer
circularBuffer.pop(); // returns 20
circularBuffer.pop(); // returns 30
circularBuffer.size(); // returns 2
circularBuffer.pop(); // returns 40
circularBuffer.pop(); // returns 50
circularBuffer.size(); // returns 0
circularBuffer.pop(); // returns null

// Iterate from front to rear. forEach's index is the element's slot in the
// ring buffer, and arr is the ring buffer itself.
circularQueue.push(10); // returns true
circularQueue.push(20); // returns true
circularQueue.push(30); // returns true
circularQueue.pop(); // returns 10
circularQueue.size(); // returns 2
circularQueue.forEach((elem, index, arr) => {
	console.log(elem + ' is at index ' + index + ' in array ' + JSON.stringify(arr));
}); // returns circularQueue
// outputs '20 is at index 1 in array [10,20,30]'
// outputs '30 is at index 2 in array [10,20,30]'

circularQueue.push(40); // returns true
circularQueue.push(50); // returns true, stored in slot 0 after wrapping around
circularQueue.size(); // returns 4
circularQueue.forEach((elem, index, arr) => {
	console.log(elem + ' is at index ' + index + ' in array ' + JSON.stringify(arr));
}); // returns circularQueue
// outputs '20 is at index 1 in array [50,20,30,40]'
// outputs '30 is at index 2 in array [50,20,30,40]'
// outputs '40 is at index 3 in array [50,20,30,40]'
// outputs '50 is at index 0 in array [50,20,30,40]'

// Iterate values front to rear
[...circularQueue]; // returns [20, 30, 40, 50]

// Returns the current state of the queue as a JSON string
const serialized = circularQueue.stringify();
```


## **`PriorityQueue<T>`**

Binary heap. The comparator returns `true` when `a` should be closer to the front than `b`, so `(a, b) => a < b` gives a min heap and `(a, b) => a > b` a max heap.

Typescript

```typescript
// Import
import {PriorityQueue, PriorityQueueComparator} from '@toreda/adt';

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

// Iterate through the queue in heap order, which is not sorted order
priorityQueue.forEach((elem, index, arr) => {
	console.log(elem + ' is at index ' + index + ' in array ' + JSON.stringify(arr));
}); // returns priorityQueue
// outputs '10 is at index 0 in array [10,20]'
// outputs '20 is at index 1 in array [10,20]'

// Remove and return the highest priority element
priorityQueue.pop(); // returns 10
priorityQueue.pop(); // returns 20
priorityQueue.pop(); // returns null

// Reset priority queue and remove all elements
priorityQueue.reset(); // returns priorityQueue

// Add 3 elements via chained push calls
priorityQueue.push(30).push(10).push(20);

// Returns the current state of the queue as a JSON string
const serialized = priorityQueue.stringify(); // returns '{"type":"PriorityQueue","elements":[10,30,20]}'

// Instantiate a priority queue using serialized state
const priorityQueueFromSerialized = new PriorityQueue<number>(minFirst, {serializedState: serialized});
priorityQueueFromSerialized.peek(); // returns 10
```

## **`ObjectPool<T>`**

Pool of reusable object instances. Objects are created up front and handed out by `allocate()`, and `release()` cleans them with `cleanObj()` and stores them for reuse.

Default options: `startSize: 1`, `maxSize: 1000`, `autoIncrease: false`, `increaseBreakPoint: 1`, `increaseFactor: 2`. With `autoIncrease` on, the pool grows by `increaseFactor` once the share of objects in use would pass `increaseBreakPoint`, up to `maxSize`.

Typescript

```typescript
// Import
import {ObjectPool, ObjectPoolInstance} from '@toreda/adt';

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

// Number of objects currently allocated
objectPool.size(); // returns 11

// Share of the pool's objects in use
objectPool.utilization(); // returns 0.11
objectPool.utilization(39); // returns 0.5, counting 39 more pending allocations

// Allocating past increaseBreakPoint grows the pool
objectPool.allocateMultiple(85); // returns array of 85 instances; pool grows from 100 to 200 objects

// Manually increase pool capacity. Capacity never passes maxSize.
objectPool.increaseCapacity(5000); // pool now holds 1000 objects

// Iterate objects currently allocated
objectPool.forEach((obj, index) => {
	console.log(obj.name + ' is allocated');
}); // returns objectPool
const names = objectPool.map((obj) => obj.name); // returns array of 96 names

// Release objects back into pool. Each is cleaned with cleanObj().
objectPool.release(obj1!);
objectPool.releaseMultiple(objs);
objectPool.size(); // returns 85

// Release every allocated object. Pool capacity is kept.
objectPool.clearElements(); // returns objectPool
objectPool.size(); // returns 0

// Drop every object and refill the pool to startSize
objectPool.reset(); // returns objectPool

// Returns the pool's config as a JSON string. Objects are not included.
const serialized = objectPool.stringify();

// Instantiate an object pool using a serialized config
const objectPoolFromSerialized = new ObjectPool<ObjectClass>(ObjectClass, {serializedState: serialized});
```

## **`BinarySearchTree<T>`**

Unbalanced binary search tree ordered by a comparator you provide. Each node's left subtree holds smaller items and its right subtree holds equal or larger items, so walking the tree in order visits items sorted. Search, insert, and removal take O(h), where h is the tree's height: O(log n) on average for items inserted in random order, O(n) for items inserted already sorted. Implements the shared `Tree` interface.

The comparator is required and works like the `Array.prototype.sort` compare function: negative when `a` sorts first, positive when `b` sorts first, `0` when equal.

### Basics

Typescript

```typescript
// Import
import {BinarySearchTree, BinarySearchTreeComparator} from '@toreda/adt';

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

The tree cannot see changes made to an item after it was inserted. After changing a field the comparator reads, call `update(node, item)`. When the item still belongs where its node sits, nothing moves and the same node is returned. Otherwise the node is removed and the item is inserted again as a new node, which is returned. Don't use the old node after that.

```typescript
const node = leaderboard.find({name: '', score: 90})!; // node holding ben

// Change the item in place, then pass the node's own item
const ben = node.value()!;
ben.score = 200;
const moved = leaderboard.update(node, ben); // returns the new node holding ben

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
import {BinarySearchTree, BinarySearchTreeError} from '@toreda/adt';

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
```

### Node pooling

Node wrappers are pooled by default. A removed node is recycled for a later insert, so once the pool has grown, inserts in steady state create no new objects. After a node is removed, don't use it again; read the removed item from the return value of `remove()` or `removeNode()`.

```typescript
// Tune the internal pool with ObjectPool options. Omitted entries keep the defaults.
const pooled = new BinarySearchTree<number>((a, b) => a - b, [], {pool: {startSize: 64, maxSize: 4096}});

// Only strict `true` disables pooling
const unpooled = new BinarySearchTree<number>((a, b) => a - b, [], {disableElementPooling: true});
```

# Query Selectors

Every collection supports `query()`. A query takes one filter, or an array of filters that must all match, and returns one `QueryResult` per match. Each result holds the matched `element` and offers `index()`, `key()`, and `delete()`.

Typescript

```typescript
import {QueryFilter, QueryOptions, QueryResult} from '@toreda/adt';
import {BinarySearchTree, CircularQueue, LinkedList, PriorityQueue, Queue, Stack} from '@toreda/adt';

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

// Add elements to all ADTs
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

// Get the element in query result. Node-based ADTs return the node.
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
resultsCircularQueue[0].index(); // returns 2 (slot in the ring buffer)
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
resultsCircularQueue[0].index(); // returns 2 (the slot did not move)
resultsPriorityQueue[0].index(); // returns 2

// Delete query result from original ADT. Returns the removed item.
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

# Install
Install `@toreda/adt` from NPM, or [clone the GitHub repo](https://github.com/toreda/adt) to work on it.

### Install using pnpm
Add the package to your project:
```bash
pnpm add @toreda/adt
```

Or, in a clone of the repo, open a shell in the project root folder and install its dependencies:
```bash
pnpm install
```

# License

[MIT](LICENSE.md) &copy; Toreda, Inc.
