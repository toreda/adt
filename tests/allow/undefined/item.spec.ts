import {BinarySearchTree} from '../../../src/binary/search/tree';
import {CircularQueue} from '../../../src/circular/queue';
import {DirectedGraph} from '../../../src/directed/graph';
import {LinkedList} from '../../../src/linked/list';
import {OctTree} from '../../../src/oct/tree';
import {PriorityQueue} from '../../../src/priority/queue';
import {QuadTree} from '../../../src/quad/tree';
import {Queue} from '../../../src/queue';
import {RedBlackTree} from '../../../src/red/black/tree';
import {SpatialHash} from '../../../src/spatial/hash';
import {SpatialMap} from '../../../src/spatial/map';
import {Stack} from '../../../src/stack';
import {Trie} from '../../../src/trie';
import {undefinedItemSkip} from '../../../src/utility';

/** Seed data with undefined entries, as an untyped caller could pass it. */
const dirty = [1, undefined, 2] as number[];
const strict = {allowUndefinedItem: false};

/** Reads properties of the item, so calling it with undefined would throw. */
const byNumber = (a: number, b: number): boolean => a.valueOf() < b.valueOf();
const keyOf = (item: {key: string}): string => item.key;
const locate3d = (item: {x: number; y: number; z: number}): {x: number; y: number; z: number} => ({
	x: item.x,
	y: item.y,
	z: item.z
});

describe('allowUndefinedItem', () => {
	describe('undefinedItemSkip', () => {
		it('passes defined items through, including null', () => {
			expect(undefinedItemSkip(1, true, 'Test')).toBe(false);
			expect(undefinedItemSkip(null, true, 'Test')).toBe(false);
			expect(undefinedItemSkip(null, false, 'Test')).toBe(false);
		});

		it('skips undefined by default and throws when disallowed', () => {
			expect(undefinedItemSkip(undefined, true, 'Test')).toBe(true);
			expect(() => undefinedItemSkip(undefined, false, 'Test')).toThrow(
				'Test received an undefined item and allowUndefinedItem is false'
			);
		});
	});

	describe('Stack', () => {
		it('skips undefined in constructor data and push by default', () => {
			const stack = new Stack<number>(dirty);

			expect(stack.size()).toBe(2);
			expect(stack.values()).toEqual([2, 1]);
			expect(stack.push(undefined as any)).toBe(stack);
			expect(stack.size()).toBe(2);
		});

		it('throws when disallowed, in the constructor and in push', () => {
			expect(() => new Stack<number>(dirty, strict)).toThrow();

			const stack = new Stack<number>(null, strict);
			expect(() => stack.push(undefined as any)).toThrow();
			expect(stack.size()).toBe(0);
		});

		it('filter carries the option', () => {
			const derived = new Stack<number>([1, 2], strict).filter(() => true);

			expect(() => derived.push(undefined as any)).toThrow();
		});
	});

	describe('Queue', () => {
		it('skips undefined in options.elements and push by default', () => {
			const queue = new Queue<number>({elements: dirty});

			expect(queue.size()).toBe(2);
			expect(queue.values()).toEqual([1, 2]);
			queue.push(undefined as any);
			expect(queue.size()).toBe(2);
		});

		it('throws when disallowed', () => {
			expect(() => new Queue<number>({elements: dirty, ...strict})).toThrow();
			expect(() => new Queue<number>(strict).push(undefined as any)).toThrow();
		});
	});

	describe('PriorityQueue', () => {
		it('skips undefined in options.elements and push by default', () => {
			const queue = new PriorityQueue<number>(byNumber, {elements: dirty});

			expect(queue.size()).toBe(2);
			expect(queue.pop()).toBe(1);
			queue.push(undefined as any);
			expect(queue.size()).toBe(1);
		});

		it('throws when disallowed', () => {
			expect(() => new PriorityQueue<number>(byNumber, {elements: dirty, ...strict})).toThrow();
			expect(() => new PriorityQueue<number>(byNumber, strict).push(undefined as any)).toThrow();
		});
	});

	describe('CircularQueue', () => {
		it('skips undefined without ending an array walk', () => {
			const queue = new CircularQueue<number>(dirty);

			expect(queue.size()).toBe(2);
			expect(queue.values()).toEqual([1, 2]);
			expect(queue.push(undefined as any)).toBe(false);
			expect(queue.insertFront(undefined as any)).toBe(false);
			expect(queue.pushArray([3, undefined as any, 4])).toBe(true);
			expect(queue.values()).toEqual([1, 2, 3, 4]);
			expect(queue.insertFrontArray([undefined as any, 0])).toBe(true);
			expect(queue.values()).toEqual([0, 1, 2, 3, 4]);
		});

		it('throws when disallowed', () => {
			expect(() => new CircularQueue<number>(dirty, strict)).toThrow();

			const queue = new CircularQueue<number>(null, strict);
			expect(() => queue.push(undefined as any)).toThrow();
			expect(() => queue.insertFront(undefined as any)).toThrow();
			expect(() => queue.pushArray([1, undefined as any])).toThrow();
			expect(queue.values()).toEqual([1]);
		});
	});

	describe('LinkedList', () => {
		it('throws for undefined when disallowed, still returns null for null', () => {
			expect(() => new LinkedList<number>(dirty, strict)).toThrow();

			const list = new LinkedList<number>(null, strict);
			expect(() => list.insert(undefined as any)).toThrow();
			expect(() => list.insertAtHead(undefined as any)).toThrow();
			expect(list.insert(null as any)).toBeNull();
			expect(list.size()).toBe(0);
		});

		it('filter carries the option', () => {
			const derived = new LinkedList<number>([1, 2], strict).filter(() => true);

			expect(() => derived.insert(undefined as any)).toThrow();
		});
	});

	describe('BinarySearchTree / RedBlackTree', () => {
		it('returns undefined_item without calling the comparator', () => {
			const bst = new BinarySearchTree<number>(byNumber, dirty);
			const rbt = new RedBlackTree<number>(byNumber, dirty);

			expect(bst.size()).toBe(2);
			expect(rbt.size()).toBe(2);
			expect(bst.insert(undefined as any)).toBe('undefined_item');
			expect(rbt.insert(undefined as any)).toBe('undefined_item');
			expect(bst.size()).toBe(2);
			expect(rbt.size()).toBe(2);
		});

		it('throws when disallowed', () => {
			expect(() => new BinarySearchTree<number>(byNumber, dirty, strict)).toThrow();
			expect(() => new RedBlackTree<number>(byNumber, dirty, strict)).toThrow();
			expect(() => new BinarySearchTree<number>(byNumber, null, strict).insert(undefined as any)).toThrow();
			expect(() => new RedBlackTree<number>(byNumber, null, strict).insert(undefined as any)).toThrow();
		});
	});

	describe('Trie', () => {
		it('returns invalid_key without calling the key selector', () => {
			const trie = new Trie<{key: string}>(keyOf, [{key: 'a'}, undefined as any]);

			expect(trie.size()).toBe(1);
			expect(trie.insert(undefined as any)).toBe('invalid_key');
			expect(trie.size()).toBe(1);
		});

		it('throws when disallowed', () => {
			expect(() => new Trie<{key: string}>(keyOf, [undefined as any], strict)).toThrow();
			expect(() => new Trie<{key: string}>(keyOf, null, strict).insert(undefined as any)).toThrow();
		});
	});

	describe('QuadTree / OctTree', () => {
		const locate2d = (item: {x: number; y: number}): {x: number; y: number} => ({x: item.x, y: item.y});
		const p2 = {x: 1, y: 2};
		const p3 = {x: 1, y: 2, z: 3};

		it('returns invalid_position without calling the locator', () => {
			const quad = new QuadTree<{x: number; y: number}>(locate2d, [p2, undefined as any]);
			const oct = new OctTree<{x: number; y: number; z: number}>(locate3d, [p3, undefined as any]);

			expect(quad.size()).toBe(1);
			expect(oct.size()).toBe(1);
			expect(quad.insert(undefined as any)).toBe('invalid_position');
			expect(oct.insert(undefined as any)).toBe('invalid_position');
		});

		it('throws when disallowed', () => {
			expect(() => new QuadTree(locate2d, [undefined as any], strict)).toThrow();
			expect(() => new OctTree(locate3d, [undefined as any], strict)).toThrow();
			expect(() => new QuadTree(locate2d, null, strict).insert(undefined as any)).toThrow();
			expect(() => new OctTree(locate3d, null, strict).insert(undefined as any)).toThrow();
		});
	});

	describe('SpatialHash / SpatialMap', () => {
		const p3 = {x: 1, y: 2, z: 3};

		it('returns invalid_position without calling the locator', () => {
			const hash = new SpatialHash<{x: number; y: number; z: number}>(locate3d, [p3, undefined as any]);
			const map = new SpatialMap<{x: number; y: number; z: number}>(locate3d, [p3, undefined as any]);

			expect(hash.size()).toBe(1);
			expect(map.size()).toBe(1);
			expect(hash.insert(undefined as any)).toBe('invalid_position');
			expect(map.insert(undefined as any)).toBe('invalid_position');
		});

		it('throws when disallowed', () => {
			expect(() => new SpatialHash(locate3d, [undefined as any], strict)).toThrow();
			expect(() => new SpatialMap(locate3d, [undefined as any], strict)).toThrow();
			expect(() => new SpatialHash(locate3d, null, strict).insert(undefined as any)).toThrow();
			expect(() => new SpatialMap(locate3d, null, strict).insert(undefined as any)).toThrow();
		});
	});

	describe('DirectedGraph', () => {
		it('adds no vertex for undefined and returns null', () => {
			const graph = new DirectedGraph<number>(dirty);

			expect(graph.size()).toBe(2);
			expect(graph.addVertex(undefined as any)).toBeNull();
			expect(graph.size()).toBe(2);
			expect(graph.addVertexArray([3, undefined as any]).length).toBe(1);
			expect(graph.values()).toEqual([1, 2, 3]);
		});

		it('throws when disallowed', () => {
			expect(() => new DirectedGraph<number>(dirty, strict)).toThrow();
			expect(() => new DirectedGraph<number>(null, strict).addVertex(undefined as any)).toThrow();
		});
	});
});
