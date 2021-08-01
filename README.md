# `@toreda/adt` Abstract Data Types

![Toreda](https://content.toreda.com/logo/toreda-logo.png)

![CI](https://github.com/toreda/adt/workflows/CI/badge.svg?branch=master) [![Coverage](https://sonarcloud.io/api/project_badges/measure?project=toreda_adt&metric=coverage)](https://sonarcloud.io/dashboard?id=toreda_adt) [![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=toreda_adt&metric=alert_status)](https://sonarcloud.io/dashboard?id=toreda_adt)

Collection of TypeScript generic data structures with consistent APIs for search, insertion, and deletion.

# Contents
* [**Data Structures**](#data-structures)
	* [`CircularQueue`](#CircularQueueT)
	* [`LinkedList`](#LinkedListT)
	* [`PriorityQueue`](#PriorityQueueT)
	* [`ObjectPool`](#ObjectPoolT)
	* [`Queue`](#QueueT)
	* [`Stack`](#StackT)
* [**Package**](#Package)
	* [Build](#Build)
	* [Testing](#testing)
	* [License](#license)

# **`ADT` Interface**
Each ADT uses TypeScript generics of type<T> and implements `ADT` and `Element` interfaces.

`ADT` requires these functions:
* `clearElements(): void`
* `reset(): void`
* `stringify(): string | null`
* `query(`<br>
	 `query: ADTQueryFilter<T> | ADTQueryFilter<T>[],`<br>
	 `options?: ADTQueryOptions`<br>
	 `): ADTQueryResult<T>[] | ADTQueryResult<ADTElement<T>>[];`

# Data Structures

* [`Stack`](#StackT)
* [`Queue`](#QueueT)
* [`LinkedList`](#LinkedListT)
* [`CircularQueue`](#CircularQueueT)
* [`PriorityQueue`](#PriorityQueueT)
* [`ObjectPool`](#ObjectPoolT)

## `Stack<T>`

Typescript

```typescript
// Import
import {Stack} from '@toreda/adt';
// Instantiate
const myStack = new Stack<string>();
const myStackWithOption = new Stack<string>({
	elements: ['a', 'b', 'c']
});

// Add elements to stack
myStack.push("my string 1"); // return myStack
myStack.push("my string 2"); // return myStack

// Get stack size
const size = myStack.size(); // returns 2

// Iterate through elements
myStack.forEach((elem, index, arr) => {
	console.log(elem + ' is at index ' + index + ' in array ' + arr)
}); // returns myStack
// outputs 'my string 2 is at index 0 in array ["my string 2", "my string 1"]'
// outputs 'my string 1 is at index 1 in array ["my string 2", "my string 1"]'

// Remove first element from stack
const result1 = myStack.pop(); // returns "my string 2"
const result2 = myStack.pop(); // returns "my string 1"
const result3 = myStack.pop(); // returns null because myStack is already empty.

// Reset stack and remove all elements.
myStack.reset(); // returns myStack

// Queue 3 items via chained push calls.
myStack.push("one").push("two").push("three");

// Reverse the order of stack elements.
// "one", "two", "three" becomes "three", "two", "one"
myStack.reverse();

// Returns the current state of stack as string
const serialized = myStack.stringify();

// Instantiate a queue using serialized state
const serialStack = new Stack({serializedState: serialized});
```


## `Queue<T>`

Typescript

```typescript
// Import
import {Queue} from '@toreda/adt';
// Instantiate
const myQueue = new Queue<string>();
const myQueueWithOption = new Queue<string>({
	elements: ['a', 'b', 'c']
});

// Add elements to queue
myQueue.push("my string 1"); // return myQueue
myQueue.push("my string 2"); // return myQueue

// Get queue size
const size = myQueue.size(); // returns 2

// Iterate through elements
myQueue.forEach((elem, index, arr) => {
	console.log(elem + ' is at index ' + index + ' in array ' + arr)
}); // returns myQueue
// outputs 'my string 1 is at index 0 in array ["my string 1", "my string 2"]'
// outputs 'my string 2 is at index 1 in array ["my string 1", "my string 2"]'

// Remove first element from queue
const result1 = myQueue.pop(); // returns "my string 1"
const result2 = myQueue.pop(); // returns "my string 2"
const result3 = myQueue.pop(); // returns null because myQueue is already empty.

// Reset queue and remove all elements.
myQueue.reset(); // returns myQueue

// Queue 3 items via chained push calls.
myQueue.push("one").push("two").push("three");

// Reverse the order of queued elements.
// "one", "two", "three" becomes "three", "two", "one"
myQueue.reverse();

// Returns the current state of queue as string
const serialized = myQueue.stringify();

// Instantiate a queue using serialized state
const serialQueue = new Queue({serializedState: serialized});
```

## `LinkedList<T>`

Typescript

```typescript
// Import
import {LinkedList} from '@toreda/adt';
// Instantiate
const myLinkedList = new LinkedList<string>();
const myStackWithOption = new Stack<string>({
	elements: ['a', 'b', 'c']
});

// Add elements to the tail of linked list
myLinkedList.insert("my string 1"); // returns arg converted to LinkedListElement
myLinkedList.insert("my string 2"); // returns arg converted to LinkedListElement
myLinkedList.insertAtTail("my string 3"); // returns arg converted to LinkedListElement

// Add elements to the head of linked list
myLinkedList.insertAtHead("my string 0"); // returns arg converted to LinkedListElement

// Get linked list size
const size = myLinkedList.size(); // returns 4

// Get head of linked list
let head = myLinkedList.head();// returns object holding "my string 0" as value

// Get tail of linked list
let tail = myLinkedList.tail();// returns object holding "my string 3" as value

// Get value of linked list element
let headValue = head.value(); // returns "my string 0"
let tailValue = tail.value(); // returns "my string 3"

// Set value of linked list element
head.value("MY STRING 0"); // returns null
tail.value("MY STRING 3"); // returns null

// Move to next linked node
let next = head.next() // returns object holding "my string 1" as value
next = next.next() // returns object holding "my string 2" as value
next = next.next() // returns object holding "MY STRING 3" as value
next = next.next() // returns null

// Move to previous linked node
let prev = head.prev() // returns object holding "my string 2" as value
prev = prev.prev() // returns object holding "my string 1" as value
prev = prev.prev() // returns object holding "MY STRING 0" as value
prev = prev.prev() // returns null

// Iterate through elements
myLinkedList.forEach((elem, index, arr) => {
	console.log(elem + ' is at index ' + index + ' in array ' + arr)
}); // returns myLinkedList
// outputs 'MY STRING 0 is at index 0 in array ["MY STRING 0", "my string 1", "my string 2", "MY STRING 3]'
// outputs 'my string 1 is at index 1 in array ["MY STRING 0", "my string 1", "my string 2", "MY STRING 3]'
// outputs 'my string 2 is at index 2 in array ["MY STRING 0", "my string 1", "my string 2", "MY STRING 3]'
// outputs 'MY STRING 3 is at index 3 in array ["MY STRING 0", "my string 1", "my string 2", "MY STRING 3]'

// Remove node from linked list
myLinkedList.deleteNode(head); // returns "MY STRING 0"
myLinkedList.deleteNode(tail); // returns "MY STRING 3"
myLinkedList.head(); // returns "my string 1"
myLinkedList.tail(); // returns "my string 2"

// Reset linked list and remove all elements.
myLinkedList.reset(); // returns myLinkedList

// Reverse the order of queued elements.
// "one", "two", "three" becomes "three", "two", "one"
myLinkedList.reverse();

// Returns the current state of queue as string
const serialized = myLinkedList.stringify();

// Instantiate a queue using serialized state
const serialLinkedList = new LinkedList({serializedState: serialized});
```


## **`CircularQueue<T>`**

Typescript

```typescript
// Import
import {CircularQueue} from '@toreda/adt';

// Instantiate
const circularQueueDefault = new CircularQueue<number>();
const circularQueueWithOptions = new CircularQueue<number>({
	maxSize: 999,
	size: 3,
	elements[,,,1,2,3,],
	front: 3,
	rear: 5,
	overwrite: true
});

// Use as Queue
const circularQueue = new CircularQueue<number>({
	maxSize: 4,
});

// Add element to the queue
circularQueue.push(10) // returns true;
circularQueue.push(20) // returns true;
circularQueue.push(30) // returns true;
circularQueue.push(40) // returns true;
circularQueue.push(50) // returns false;

// Get queue size
circularQueue.size(); // returns 4

// Get first element added to queue
circularQueue.front(); // returns 10

// Get last element added to queue
circularQueue.rear(); // returns 40

// Get nth-after-first element added to queue
circularQueue.getIndex(1); // returns 20
circularQueue.getIndex(2); // returns 30

// Get nth-to-last element added to queue
circularQueue.getIndex(-1); // returns 30
circularQueue.getIndex(-2); // returns 20

// Remove element from the queue
circularQueue.pop(); // returns 10
circularQueue.pop(); // returns 20
circularQueue.size(); // returns 2
circularQueue.pop(); // returns 30
circularQueue.pop(); // returns 40
circularQueue.size(); // returns 0
circularQueue.pop(); // returns null

// Use as Buffer
const circularBuffer = new CircularQueue<number>({
	maxSize: 4,
	overwrite: true
});

// Add element to the buffer
circularBuffer.push(10) // returns true;
circularBuffer.push(20) // returns true;
circularBuffer.push(30) // returns true;
circularBuffer.push(40) // returns true;
circularBuffer.push(50) // returns true;

// Get queue size
circularBuffer.size(); // returns 4

// Get first element added to buffer
circularBuffer.front(); // returns 20

// Get last element added to buffer
circularBuffer.rear(); // returns 50

// Get nth-after-first element added to buffer
circularBuffer.getIndex(1); // returns 30
circularBuffer.getIndex(2); // returns 40

// Get nth-to-last element added to buffer
circularBuffer.getIndex(-1); // returns 40
circularBuffer.getIndex(-2); // returns 30

// Remove element from the buffer
circularBuffer.pop(); // returns 20
circularBuffer.pop(); // returns 30
circularBuffer.size(); // returns 2
circularBuffer.pop(); // returns 40
circularBuffer.pop(); // returns 50
circularBuffer.size(); // returns 0
circularBuffer.pop(); // returns null

// Remove all elements from buffer
circularQueue.clearElements();

// Iterate through queue
circularQueue.push(10); // returns true
circularQueue.push(20); // returns true
circularQueue.push(30); // returns true
circularQueue.pop(); // returns 10
circularQueue.size() // returns 2
circularQueue.forEach((elem, index, arr) => {
	console.log(elem + ' is at index ' + index + ' in array ' + arr)
}); // returns circularQueue
// outputs '20 is at index 1 in array [10, 20, 30]'
// outputs '30 is at index 2 in array [10, 20, 30]'

circularQueue.push(40); // returns true
circularQueue.push(50); // returns true
circularQueue.size() // returns 4
circularQueue.forEach((elem, index, arr) => {
	console.log(elem + ' is at index ' + index + ' in array ' + arr)
}); // returns circularQueue
// outputs '20 is at index 1 in array [50, 20, 30, 40]'
// outputs '30 is at index 2 in array [50, 20, 30, 40]'
// outputs '40 is at index 3 in array [50, 20, 30, 40]'
// outputs '50 is at index 0 in array [50, 20, 30, 40]'

circularQueue.pop(); // returns 20
circularQueue.pop(); // returns 30
circularQueue.size() // returns 2
circularQueue.forEach((elem, index, arr) => {
	console.log(elem + ' is at index ' + index + ' in array ' + arr)
}); // returns circularQueue
// outputs '40 is at index 3 in array [50, 20, 30, 40]'
// outputs '50 is at index 0 in array [50, 20, 30, 40]'

// Returns the current state of priorityQueue as string
const serialized = circularQueue.stringify();

// Instantiate a Priority Queue using serialized state
const circularQueueFromSerialized = new CircularQueue({serializedState: serialized});
```


## **`PriorityQueue<T>`**

Typescript

```typescript
// Import
import {PriorityQueue, PriorityQueueComparator} from '@toreda/adt';

// Instantiate
const priorityQueueComparator: PriorityQueueComparator<number> = function(a, b) => a < b;
const priorityQueue = new PriorityQueue<number>(priorityQueueComparator);
const priorityQueueWithOptions = new PriorityQueue<number>(priorityQueueComparator, {
	elements: [1,2,3,4,5,6,7]
});

// Add elements to the queue
priorityQueue.push(20); // returns priorityQueue
priorityQueue.push(10); // returns priorityQueue

// Get number of elements in queue
const size = priorityQueue.size(); // returns 2

// Get the root element of the queue
const result = priorityQueue.front(); // returns 10

// Iterate through queue
priorityQueue.forEach((elem, index, arr) => {
	console.log(elem + ' is at index ' + index + ' in array ' + arr)
}); // returns priorityQueue
// outputs '10 is at index 0 in array [10, 20]'
// outputs '20 is at index 1 in array [10, 20]'

// Get the root element of the queue and remove it
const result1 = priorityQueue.pop(); // returns 10
const result2 = priorityQueue.pop(); // returns 20
const result3 = priorityQueue.pop(); // returns null

// Reset priority queue and remove all elements
priorityQueue.reset(); // returns priorityQueue

// Add 3 elements via chained push calls
priorityQueue.push(30).push(10).push(20);

// Returns the current state of priorityQueue as string
const serialized = priorityQueue.stringify();

// Instantiate a Priority Queue using serialized state
const priorityQueueFromSerialized = new PriorityQueue(priorityQueueComparator, {serializedState: serialized});
```

## **`ObjectPool<T>`**

Typescript

```typescript
// Import
import {ObjectPool, ObjectPoolInstance} from '@toreda/adt';

// Instantiate
class objectClass implements ObjectPoolInstance {
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

const objectPool = new ObjectPool<objectClass>(objectClass);
const objectPoolWithOptions = new ObjectPool<objectClass>(objectClass, {
	maxSize: 10000,
	startSize: 100,
	autoIncrease: true,
	increaseBreakPoint: .9,
	increaseFactor: 10
});

// Get 1 object from the pool
const obj1 = objectPool.allocate(); // returns object<objectClass>

// Get array of n objects from the pool;
const objs = objectPool.allocateMultiple(10); // returns array of 10 object<objectClass>

// Get % of pool being used
const usage = objectPool.utilization(); // returns .11
const usage = objectPool.utilization(39); // returns .5

// Manually increase pool capacity
objectPool.increaseCapacity(100); // objectPool.state.size === 200;
objectPool.increaseCapacity(20000); // objectPool.state.size === 10000;

// Release objects back into pool
objectPool.release(obj1);
objectPool.releaseMultiple(objs);

// Remove all elements from pool
objectPool.clearElements();

// Returns the current state of pool as string
const serialized = objectPool.stringify();

// Instantiate an Object Pool using serialized state
const objectPoolFromSerialized = new PriorityQueue<objectClass>(objectClass, {serializedState: serialized});
```

# Query Selectors

Typescript

```typescript
import {QueryFilter, QueryResult, QueryOptions} from '@toreda/adt';
import {Queue, Stack, LinkedList, CircularQueue, PriorityQueue, ObjectPool} from '@toreda/adt';

const myQueue = new Queue<number>();
const myStack = new Stack<number>();
const myLinkedList = new LinkedList<number>();
const myCircularQueue = new CircularQueue<number>();
const myPriorityQueue = new PriorityQueue<number>((a, b) => a < b);
const myObjectPool = new ObjectPool<custom>(custom);

// Create a query filter function
const basicQueryFilter: QueryFilter<number> = (value) => {
	return value === 30
}

// Create a query filter function generator
const genQueryFilter = function (target: number, lessthan: boolean) = QueryFilter<number> {
	const filter: QueryFilter<number> = (value) => {
		if (lessthan) {
			return value < target;
		} else {
			return value > target;
		}
	}
}

// Add elements to all ADTs
myObjectPool.allocateMultiple(5);
[10, 20, 30, 40, 50].forEach((value, index) => {
	myQueue.push(value);
	myStack.push(value);
	myLinkedList.insert(value);
	myCircularQueue.push(value);
	myPriorityQueue.push(value);
	myObjectPool.state.used[index] = value
});


// Use a query filter to get a query result
let resultsQueue = myQueue.query(basicQueryFilter); // return array of query result objects
let resultsStack = myStack.query(basicQueryFilter); // return array of query result objects
let resultsLinkedList = myLinkedList.query(basicQueryFilter); // return array of query result objects
let resultsCircularQueue = myCircularQueue.query(basicQueryFilter); // return array of query result objects
let resultsPriorityQueue = myPriorityQueue.query(basicQueryFilter); // return array of query result objects
let resultsObjectPool = myObjectPool.query(basicQueryFilter); // return array of query result objects

// Get the element in query result
resultQueue[0].element; // returns 30
resultStack[0].element; // returns 30
resultLinkedList[0].element; // returns linked list element with value 30
resultCircularQueue[0].element; // returns 30
resultPriorityQueue[0].element; // returns 30
resultObjectPool[0].element; // returns 30

// Get the current index of the query result
resultQueue[0].index(); // returns 2
resultStack[0].index(); // returns 2
resultLinkedList[0].index(); // returns null
resultCircularQueue[0].index(); // returns 2
resultPriorityQueue[0].index(); // returns 2
resultObjectPool[0].index(); // returns 2

myQueue.pop(); // returns 10
myStack.pop(); // returns 50
myLinkedList.deleteNode(myLinkedList.head()); // returns 10
myCircularQueue.pop(); // returns 10
myPriorityQueue.pop(); // returns 10
myObjectPool.pop(); // returns 10

resultQueue[0].index(); // returns 1
resultStack[0].index(); // returns 2
resultLinkedList[0].index(); // returns null
resultCircularQueue[0].index(); // returns 2
resultPriorityQueue[0].index(); // returns 2
resultObjectPool[0].index(); // returns 2

// Delete query result from original ADT
resultQueue[0].delete(); // returns 30
resultStack[0].delete(); // returns 30
resultLinkedList[0].delete(); // returns 30
resultCircularQueue[0].delete(); // returns 30
resultObjectPool[0].delete(); // returns 30

// Use multiple query filters and query options
myQueue.reset();
myQueue.push(10).push(20).push(30).push(40).push(50)

const filters: ADTQueryFilter[] = [];
filters.push(genQueryFilter(10, false));
filters.push(genQueryFilter(50, true));

queryResults = myQueue.query(filters, {limit: 2}) // returns array of query result objects;
queryResults[0].element; // returns 20
queryResults[1].element; // returns 30
```

# Install
Install `@toreda/adt` directly from NPM or [clone the Github repo](https://github.com/toreda/adt).

### Install using Yarn (preferred)
 1. Open a shell (or console).
 2. Navigate to the the adt project root folder.
 3. Enter the following commands in order. Wait for each to complete before typing the next.
```bash
yarn
```

### Install using NPM
 1. Open a shell (or console).
 2. Navigate to the the `@toreda/adt` project root folder.
 3. Enter the following commands in order. Wait for each to complete before typing the next.
```bash
npm install
```


# Run Unit Tests
Install or clone `@toreda/adt` [(see above)](#install).

ADT unit tests use [Jest](https://jestjs.io/).

Installing jest is not required after project dependencies are installed ([see above](#install)).
```bash
yarn test
```

# Build from source

The next steps are the same whether you installed the package using NPM or cloned the repo from Github.

### Build with Yarn
 Enter the following commands in order from the adt project root.
```bash
yarn build
```

### Build with NPM
 Enter the following commands in order from the adt project root.
```bash
npm run-script build
```

# License

[MIT](LICENSE) &copy; Toreda, Inc.
