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

### Priority Queue

Typescript

```
// Import
import {ArmorPriorityQueue} from '@armorjs/collections';

// Instantiate
const priorityQueueComparator: ArmorPriorityQueueComparator<number> = function(a, b) => a < b;
const priorityQueue = new ArmorPriorityQueue<number>([], priorityQueueComparator);

// Add elements to the queue
priorityQueue.push(20);
priorityQueue.push(10);

// Returns 2
const size = priorityQueue.size();

// Returns 10
const result = priorityQueue.front();

// Returns 10 removes it from priorityQueue
const result1 = priorityQueue.pop();

// Returns 20 removes it from priorityQueue
const result2 = priorityQueue.pop();

// Returns null because priority queue is empty
const result3 = priorityQueue.pop();

// Reset priority queue and remove all elements
priorityQueue.reset();

// Add 3 elements via chained push calls
priorityQueue.push(30).push(10).push(20);

// Returns the current state of priorityQueue as string
const serialized = priorityQueue.stringify();

// Instantiate a Priority Queue using serialized state
const priorityQueueFromSerialized = new ArmorPriorityQueue([], priorityQueueComparator, serialized);
```

### Circular Queue

Typescript

```
// Import
import {ArmorCircularQueue} from '@armorjs/collections';

// Instantiate
const maxSize = 4;
const circularQueue = new ArmorCircularQueue<number>(maxSize);
const circularBuffer = new ArmorCircularQueue<number>(maxSize, {overwrite: true});

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

// Returns the current state of priorityQueue as string
const serialized = circularQueue.stringify();

// Instantiate a Priority Queue using serialized state
const circularQueueFromSerialized = new ArmorCircularQueue([], circularQueueComparator, serialized);

// Reset circular queue and remove all elements
circularQueue.reset();

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
