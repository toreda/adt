/**
 * Steady-state allocation benchmark.
 *
 * Measures heap bytes allocated per operation after warm-up, for the hot paths
 * the README describes as allocation-free. The young generation is enlarged so
 * no garbage collection runs during a measurement, which makes the heap delta
 * equal to the bytes allocated.
 *
 * Run after `pnpm build`:
 *   pnpm bench
 */
const L = require('../dist/cjs/index.js');

const WARMUP = 20000;
const N = 200000;
const rows = [];

function measure(name, setup, op) {
	const ctx = setup();
	for (let i = 0; i < WARMUP; i++) op(ctx, i);
	global.gc();
	global.gc();
	const before = process.memoryUsage().heapUsed;
	for (let i = 0; i < N; i++) op(ctx, i);
	const bytes = (process.memoryUsage().heapUsed - before) / N;
	rows.push({name, bytes});
}

const noop = () => {};
const byNumber = (a, b) => a - b;
const byPosition = (p) => p;

// Linear
measure('CircularQueue push + pop', () => new L.CircularQueue([], {maxSize: 64}), (q, i) => {
	q.push(i);
	q.pop();
});
measure('CircularQueue push (overwrite)', () => new L.CircularQueue([], {maxSize: 64, overwrite: true}), (q, i) =>
	q.push(i)
);
measure('Queue push + pop', () => new L.Queue(), (q, i) => {
	q.push(i);
	q.pop();
});
measure('Stack push + pop', () => new L.Stack(), (s, i) => {
	s.push(i);
	s.pop();
});
measure('PriorityQueue push + pop (100 items)', () => {
	const p = new L.PriorityQueue((a, b) => a < b);
	for (let i = 0; i < 100; i++) p.push(i);
	return p;
}, (p, i) => {
	p.push(i % 100);
	p.pop();
});
measure('LinkedList insert + removeNode', () => new L.LinkedList(), (l, i) => l.removeNode(l.insert(i)));

class Particle {
	constructor() {
		this.x = 0;
	}
	cleanObj() {
		this.x = 0;
	}
}
measure('ObjectPool allocate + release', () => new L.ObjectPool(Particle, {startSize: 64, maxSize: 64}), (p) =>
	p.release(p.allocate())
);

// Trees (1000 items held)
for (const [label, Tree] of [
	['BinarySearchTree', L.BinarySearchTree],
	['RedBlackTree', L.RedBlackTree]
]) {
	const setup = () => {
		const t = new Tree(byNumber);
		for (let i = 0; i < 1000; i++) t.insert(i * 2);
		return t;
	};
	measure(`${label} insert + remove`, setup, (t, i) => {
		const k = ((i * 7919) % 1000) * 2 + 1;
		t.insert(k);
		t.remove(k);
	});
	measure(`${label} update (move)`, () => {
		const t = setup();
		return {t, node: t.find(500)};
	}, (c, i) => c.t.update(c.node, ((i * 7919) % 1000) * 2 + 1));
}

function quadTree() {
	const t = new L.QuadTree(byPosition);
	const items = [];
	for (let i = 0; i < 1000; i++) {
		const p = {x: (i * 7919) % 1000, y: (i * 104729) % 1000};
		items.push(p);
		t.insert(p);
	}
	return {t, items};
}
const probe2 = {x: 500, y: 500};
const bounds2 = {minX: 400, minY: 400, maxX: 600, maxY: 600};
measure('QuadTree nearest', quadTree, (c, i) => {
	probe2.x = (i * 37) % 1000;
	c.t.nearest(probe2);
});
measure('QuadTree forEachWithinBounds', quadTree, (c) => c.t.forEachWithinBounds(bounds2, noop));
measure('QuadTree forEachWithinRadius', quadTree, (c) => c.t.forEachWithinRadius(probe2, 100, noop));
measure('QuadTree remove + insert', quadTree, (c, i) => {
	const p = c.items[i % 50];
	c.t.remove(p);
	c.t.insert(p);
});

const probe3 = {x: 500, y: 500, z: 500};
measure('OctTree nearest', () => {
	const t = new L.OctTree(byPosition);
	for (let i = 0; i < 1000; i++) t.insert({x: (i * 7919) % 1000, y: (i * 104729) % 1000, z: (i * 31) % 1000});
	return t;
}, (t, i) => {
	probe3.x = (i * 37) % 1000;
	t.nearest(probe3);
});

// Spatial grids (1000 items held)
function spatialHash() {
	const t = new L.SpatialHash(byPosition, null, {cellSize: 50});
	const items = [];
	const nodes = [];
	for (let i = 0; i < 1000; i++) {
		const p = {x: (i * 7919) % 1000, y: (i * 104729) % 1000, z: (i * 31) % 1000};
		items.push(p);
		nodes.push(t.insert(p));
	}
	return {t, items, nodes};
}
measure('SpatialHash nearest', spatialHash, (c, i) => {
	probe3.x = (i * 37) % 1000;
	c.t.nearest(probe3);
});
measure('SpatialHash forEachWithinRadius', spatialHash, (c) => c.t.forEachWithinRadius(probe3, 100, noop));
measure('SpatialHash update (move)', spatialHash, (c, i) => {
	const node = c.nodes[i % 1000];
	const p = node.value();
	p.x = (p.x + 137) % 1000;
	c.t.update(node, p);
});
measure('SpatialHash remove + insert', spatialHash, (c, i) => {
	const p = c.items[i % 50];
	c.t.remove(p);
	c.t.insert(p);
});
function spatialMap() {
	const t = new L.SpatialMap(byPosition);
	for (let x = 0; x < 10; x++) for (let y = 0; y < 10; y++) for (let z = 0; z < 10; z++) t.insert({x, y, z});
	return t;
}
const voxel = {x: 20, y: 0, z: 0};
measure('SpatialMap findCell', spatialMap, (t, i) => t.findCell(i % 10, (i >> 3) % 10, (i >> 6) % 10));
measure('SpatialMap insert + removeNode', spatialMap, (t, i) => {
	voxel.x = 20 + (i % 64);
	t.removeNode(t.insert(voxel));
});

// Graph (20 x 20 grid)
function grid() {
	const n = 20;
	const g = new L.DirectedGraph();
	const v = [];
	for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) v.push(g.addVertex({x, y}));
	for (let y = 0; y < n; y++) {
		for (let x = 0; x < n; x++) {
			if (x + 1 < n) g.addBidirectionalEdge(v[y * n + x], v[y * n + x + 1], 1);
			if (y + 1 < n) g.addBidirectionalEdge(v[y * n + x], v[(y + 1) * n + x], 1);
		}
	}
	return {g, v, path: {vertices: [], edges: [], cost: 0}};
}
const manhattan = (a, b) => Math.abs(a.value().x - b.value().x) + Math.abs(a.value().y - b.value().y);
measure('DirectedGraph forEachNeighbor', grid, (c, i) => c.g.forEachNeighbor(c.v[i % 400], noop));
measure('DirectedGraph findPath (A*, reused path)', grid, (c) => c.g.findPath(c.v[0], c.v[399], manhattan, c.path));
measure('DirectedGraph addEdge + removeEdge', grid, (c) => c.g.removeEdge(c.g.addEdge(c.v[0], c.v[210], 1)));

console.log(`Node ${process.version}, ${N} operations per row after ${WARMUP} warm-up operations\n`);
console.log('| Operation | Bytes per operation |');
console.log('|---|---:|');
for (const {name, bytes} of rows) console.log(`| ${name} | ${bytes < 0.5 ? '0' : bytes.toFixed(0)} |`);
