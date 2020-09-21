# ArmorJS - Collections

![CI](https://github.com/armorjs/collections/workflows/CI/badge.svg?branch=master) [![Coverage](https://sonarcloud.io/api/project_badges/measure?project=armorjs_collections&metric=coverage)](https://sonarcloud.io/dashboard?id=armorjs_collections) [![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=armorjs_collections&metric=alert_status)](https://sonarcloud.io/dashboard?id=armorjs_collections)

Collection of simple data structures with typescript interfaces.

## Contents

-   [About ArmorJS](#about-armorjs)
-   [Installation](#Installation)
-   [Usage](#usage)
-   [Build](#build)
-   [Testing](#testing)
-   [License](#license)

## About ArmorJS

[Learn more about ArmorJS](https://github.com/armorjs/_project-home)

## Install

**_With yarn (preferred):_**
`yarn add @armorjs/collections`

With NPM:
`npm install @armorjs/collections`

## Usage

### Queue

Typescript

```
// Import
import {ArmorQueue} from '@armorjs/collections';
// Instantiate
const queue = new ArmorQueue<string>();

// Add elements to queue
queue.push("my string");
queue.push("my string 2");

// Returns 2
const size = queue.size;

// Returns "my string"
const result = queue.pop();

// Returns "my string 2"
const result2 = queue.pop();

// Returns null because queue is already empty.
const result3 = queue.pop();

// Reset queue and remove all elements.
queue.reset();


// Queue 3 items via chained push calls.
queue.push("one").push("two").push("three");

// Reverse the order of queued elements.
// "one", "two", "three" becomes "three", "two", "one"
queue.reverse();
```

### Circular Queue

Typescript

```
// Import
import {ArmorCircularQueue} from '@armorjs/collections';

// Instantiate
const circularQueueDefault = new ArmorCircularQueue<number>();
const circularQueueWithOptions = new ArmorCircularQueue<number>({
	maxSize: 999,
	size: 3,
	elements[,,,1,2,3,],
	front: 3,
	rear: 5,
	overwrite: true
});

const circularQueue = new ArmorCircularQueue<number>({
	maxSize: 4,
});

const circularBuffer = new ArmorCircularQueue<number>({
	maxSize: 4,
	overwrite: true
});

// Add element to the queue
circularQueue.push(10) // returns true;
circularQueue.push(20) // returns true;
circularQueue.push(30) // returns true;
circularQueue.push(40) // returns true;
circularQueue.push(50) // returns false;

circularBuffer.push(10) // returns true;
circularBuffer.push(20) // returns true;
circularBuffer.push(30) // returns true;
circularBuffer.push(40) // returns true;
circularBuffer.push(50) // returns true;

// Get first element added to queue
circularQueue.front(); // returns 10
circularBuffer.front(); // returns 20

// Get last element added to queue
circularQueue.rear(); // returns 40
circularBuffer.rear(); // returns 50

// Get nth-after-first element added to queue
circularQueue.getIndex(1); // returns 20
circularQueue.getIndex(2); // returns 30
circularBuffer.getIndex(1); // returns 30
circularBuffer.getIndex(2); // returns 40

// Get nth-to-last element added to queue
circularQueue.getIndex(-1); // returns 30
circularQueue.getIndex(-2); // returns 20
circularBuffer.getIndex(-1); // returns 40
circularBuffer.getIndex(-2); // returns 30

// Remove element from the queue
circularQueue.pop(); // returns 10
circularQueue.pop(); // returns 20
circularQueue.pop(); // returns 30
circularQueue.pop(); // returns 40
circularQueue.pop(); // returns null

circularBuffer.pop(); // returns 20
circularBuffer.pop(); // returns 30
circularBuffer.pop(); // returns 40
circularBuffer.pop(); // returns 50
circularBuffer.pop(); // returns null

// Remove all elements from queue
circularQueue.clearElements();

// Returns the current state of priorityQueue as string
const serialized = circularQueue.stringify();

// Instantiate a Priority Queue using serialized state
const circularQueueFromSerialized = new ArmorCircularQueue({serializedState: serialized});
```

### Priority Queue

Typescript

```
// Import
import {ArmorPriorityQueue} from '@armorjs/collections';

// Instantiate
const priorityQueueComparator: ArmorPriorityQueueComparator<number> = function(a, b) => a < b;
const priorityQueue = new ArmorPriorityQueue<number>(priorityQueueComparator);
const priorityQueueWithOptions = new ArmorPriorityQueue<number>(priorityQueueComparator, {
	elements: [1,2,3,4,5,6,7]
});

// Add elements to the queue
priorityQueue.push(20); // returns queue
priorityQueue.push(10); // returns queue

// Get number of elements in queue
const size = priorityQueue.size(); // returns 2

// Get the root element of the queue
const result = priorityQueue.front(); // Returns 10

// Get the root element of the queue and remove it
const result1 = priorityQueue.pop(); // Returns 10 
const result2 = priorityQueue.pop(); // Returns 20
const result3 = priorityQueue.pop(); // Returns null

// Reset priority queue and remove all elements
priorityQueue.reset();

// Add 3 elements via chained push calls
priorityQueue.push(30).push(10).push(20);

// Remove all elements from queue
priorityQueue.clearElements();

// Returns the current state of priorityQueue as string
const serialized = priorityQueue.stringify();

// Instantiate a Priority Queue using serialized state
const priorityQueueFromSerialized = new ArmorPriorityQueue(priorityQueueComparator, {serializedState: serialized});
```

### Object Pool

Typescript

```
// Import
import {ArmorObjectPool} from '@armorjs/collections';

// Instantiate
class objectClass {
	public name!: string;
	public amount!: number;

	constructor() {
		objectClass.cleanObj(this);
	}

	static cleanObj(obj: objectClass): void {
		obj.name = '';
		obj.amount = 0;
	}
}

const objectPool = new ArmorPriorityQueue<objectClass>(objectClass);
const objectPoolWithOptions = new ArmorPriorityQueue<objectClass>(objectClass, {
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
const objectPoolFromSerialized = new ArmorPriorityQueue<objectClass>(objectClass, {serializedState: serialized});
```


### LinkedList

### Stack

## Build

Build (or rebuild) the package:

**_With Yarn (preferred):_**

```
yarn install
yarn build
```

With NPM:

```
npm install
npm run-script build
```

## Testing

`@armorjs/collections` implements unit tests using jest. Run the following commands from the directory where `@armorjs/collections` has been installed.

**_With yarn (preferred):_**

```
yarn install
yarn test
```

With NPM:

```
npm install
npm run-script test
```

## License

[MIT](LICENSE) &copy; Michael Brich
