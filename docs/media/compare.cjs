/**
 * Comparison with other data structure packages on equivalent operations.
 *
 * The compared packages are not dependencies of this repo. Install them into
 * a scratch folder next to a build of this package, or temporarily with:
 *   pnpm add -D mnemonist js-sdsl denque @datastructures-js/queue @datastructures-js/priority-queue @datastructures-js/linked-list
 * then run:
 *   node --expose-gc --max-semi-space-size=1024 bench/compare.cjs
 *
 * Each row holds 1000 items and adds one item, then removes one, per
 * operation. Bytes per operation are measured with no garbage collection
 * running. Time per operation is the median of three runs and varies by
 * machine; compare rows within one run.
 */
const T = require('../dist/cjs/index.js');
const mn = require('mnemonist');
const sdsl = require('js-sdsl');
const Denque = require('denque');
const {MinPriorityQueue} = require('@datastructures-js/priority-queue');
const {Queue: DsQueue} = require('@datastructures-js/queue');
const {DoublyLinkedList} = require('@datastructures-js/linked-list');

const N = 1000000;
const RUNS = 3;

function once(setup, op) {
	const ctx = setup();
	for (let i = 0; i < 100000; i++) op(ctx, i);
	global.gc();
	global.gc();
	const before = process.memoryUsage().heapUsed;
	const t0 = process.hrtime.bigint();
	for (let i = 0; i < N; i++) op(ctx, i);
	const ns = Number(process.hrtime.bigint() - t0) / N;
	return {bytes: (process.memoryUsage().heapUsed - before) / N, ns};
}

const rows = [];
function measure(group, name, setup, op) {
	const runs = [];
	for (let r = 0; r < RUNS; r++) runs.push(once(setup, op));
	runs.sort((a, b) => a.ns - b.ns);
	const bytes = Math.max(...runs.map((r) => r.bytes));
	rows.push({group, name, bytes, ns: runs[1].ns});
}

const items = Array.from({length: 1024}, (_, i) => ({id: i, p: (i * 7919) % 1024}));
const item = (i) => items[i & 1023];
const fill = (add) => {
	for (let i = 0; i < 1000; i++) add(item(i));
};

measure('FIFO queue', '@toreda/data-structures Queue', () => {
	const q = new T.Queue();
	fill((x) => q.push(x));
	return q;
}, (q, i) => {
	q.push(item(i));
	q.pop();
});
measure('FIFO queue', 'denque', () => {
	const q = new Denque();
	fill((x) => q.push(x));
	return q;
}, (q, i) => {
	q.push(item(i));
	q.shift();
});
measure('FIFO queue', 'js-sdsl Queue', () => {
	const q = new sdsl.Queue();
	fill((x) => q.push(x));
	return q;
}, (q, i) => {
	q.push(item(i));
	q.pop();
});
measure('FIFO queue', 'mnemonist Queue', () => {
	const q = new mn.Queue();
	fill((x) => q.enqueue(x));
	return q;
}, (q, i) => {
	q.enqueue(item(i));
	q.dequeue();
});
measure('FIFO queue', '@datastructures-js/queue', () => {
	const q = new DsQueue();
	fill((x) => q.enqueue(x));
	return q;
}, (q, i) => {
	q.enqueue(item(i));
	q.dequeue();
});

measure('Ring buffer', '@toreda/data-structures CircularQueue', () => {
	const q = new T.CircularQueue([], {maxSize: 1024});
	fill((x) => q.push(x));
	return q;
}, (q, i) => {
	q.push(item(i));
	q.pop();
});
measure('Ring buffer', 'mnemonist CircularBuffer', () => {
	const q = new mn.CircularBuffer(Array, 1024);
	fill((x) => q.push(x));
	return q;
}, (q, i) => {
	q.push(item(i));
	q.shift();
});

measure('Binary heap', '@toreda/data-structures PriorityQueue', () => {
	const q = new T.PriorityQueue((a, b) => a.p < b.p);
	fill((x) => q.push(x));
	return q;
}, (q, i) => {
	q.push(item(i));
	q.pop();
});
measure('Binary heap', 'js-sdsl PriorityQueue', () => {
	const q = new sdsl.PriorityQueue([], (a, b) => a.p - b.p);
	fill((x) => q.push(x));
	return q;
}, (q, i) => {
	q.push(item(i));
	q.pop();
});
measure('Binary heap', 'mnemonist Heap', () => {
	const q = new mn.Heap((a, b) => a.p - b.p);
	fill((x) => q.push(x));
	return q;
}, (q, i) => {
	q.push(item(i));
	q.pop();
});
measure('Binary heap', '@datastructures-js/priority-queue', () => {
	const q = new MinPriorityQueue((x) => x.p);
	fill((x) => q.enqueue(x));
	return q;
}, (q, i) => {
	q.enqueue(item(i));
	q.dequeue();
});

const byId = (a, b) => a.id - b.id;
const held = Array.from({length: 1000}, (_, i) => ({id: i * 2}));
const probes = Array.from({length: 1000}, (_, i) => ({id: ((i * 7919) % 1000) * 2 + 1}));
measure('Sorted set', '@toreda/data-structures RedBlackTree', () => new T.RedBlackTree(byId, held), (t, i) => {
	const p = probes[i % 1000];
	t.insert(p);
	t.remove(p);
});
measure('Sorted set', 'js-sdsl OrderedSet', () => new sdsl.OrderedSet(held, byId), (t, i) => {
	const p = probes[i % 1000];
	t.insert(p);
	t.eraseElementByKey(p);
});

measure('Doubly linked list', '@toreda/data-structures LinkedList', () => {
	const l = new T.LinkedList();
	fill((x) => l.insert(x));
	return l;
}, (l, i) => {
	l.insert(item(i));
	l.removeNode(l.head());
});
measure('Doubly linked list', 'js-sdsl LinkList', () => {
	const l = new sdsl.LinkList();
	fill((x) => l.pushBack(x));
	return l;
}, (l, i) => {
	l.pushBack(item(i));
	l.popFront();
});
measure('Doubly linked list', '@datastructures-js/linked-list', () => {
	const l = new DoublyLinkedList();
	fill((x) => l.insertLast(x));
	return l;
}, (l, i) => {
	l.insertLast(item(i));
	l.removeFirst();
});

console.log(`Node ${process.version}\n`);
console.log('| Structure | Package | Bytes per op | ns per op |');
console.log('|---|---|---:|---:|');
for (const r of rows) {
	console.log(`| ${r.group} | ${r.name} | ${r.bytes < 0.5 ? '0' : r.bytes.toFixed(0)} | ${Math.round(r.ns)} |`);
}
