import type {RedBlackTreeComparator} from './tree/comparator.js';
import {RedBlackTreeElement} from './tree/element.js';
import type {RedBlackTreeError} from './tree/error.js';
import {RedBlackTreeIterator} from './tree/iterator.js';
import type {RedBlackTreeMethod} from './tree/method.js';
import type {RedBlackTreeOptions} from './tree/options.js';
import {ElementPool} from '../../element/pool.js';
import type {ObjectPoolConstructor} from '../../object/pool/constructor.js';
import type {QueryFilter} from '../../query/filter.js';
import type {QueryOptions} from '../../query/options.js';
import type {QueryResult} from '../../query/result.js';
import type {Tree} from '../../tree.js';
import {booleanValue} from '../../boolean/value.js';
import {isNumber} from '../../utility.js';

/**
 * Self-balancing binary search tree ordered by a caller supplied comparator.
 * Each node is colored red or black, and insert and removal recolor and
 * rotate nodes so that the root is black, no red node has a red child, and
 * every path from a node down to a missing child passes through the same
 * number of black nodes. The tree's height therefore never exceeds
 * 2 log2(n + 1), whatever order items arrive in.
 *
 * Search, insert, and removal take O(log n) in the worst case. Insert makes at
 * most two rotations and removal at most three. Every walk is iterative.
 *
 * Node wrappers are pooled by default (see `DataStructureOptions`). Removal
 * and rotation relink nodes instead of copying values between them, so a node
 * handed out by `insert()` keeps holding its item until that item is removed.
 *
 * @remarks
 * Duplicates are allowed by default: an item comparing equal to existing ones
 * is placed after them, so equal items keep their insertion order in every
 * sorted walk. Rotations can move an equal item into a node's left subtree,
 * so the search order here is left subtree items equal or smaller, right
 * subtree items equal or larger (a plain `BinarySearchTree` keeps left
 * subtrees strictly smaller). Sorted walks, `find()`, and `remove()` behave
 * the same in both. With `allowDuplicates: false`, adding a duplicate adds
 * nothing and returns an error code instead of throwing.
 *
 * The tree cannot see changes made to an item after it was inserted. After
 * changing anything the comparator reads, call `update()` so the item is moved
 * if its position is no longer valid.
 *
 * @category Red Black Tree
 */
export class RedBlackTree<ItemT> implements Tree<ItemT, RedBlackTreeElement<ItemT>> {
	/** Orders items. Required at construction, fixed for the tree's lifetime. */
	public readonly comparator: RedBlackTreeComparator<ItemT>;
	/** Whether items comparing equal to one already in the tree are accepted. */
	public readonly allowDuplicates: boolean;
	private _root: RedBlackTreeElement<ItemT> | null;
	private _size: number;
	/** Last id handed to a linked node. Only increases, so ids never repeat. */
	private lastLinkId: number;
	/** Source of node wrappers, pooled or freshly allocated per options. */
	private readonly elements: ElementPool<RedBlackTreeElement<ItemT>>;

	/**
	 * @param comparator	Orders items. Required, since items are generic and the
	 * 						tree cannot order them itself.
	 * @param data			Items inserted in array order on creation. Any other
	 * 						input is ignored, as are duplicates when duplicates
	 * 						are not allowed.
	 * @param options		Optional config. Each option falls back to its default
	 * 						when missing or invalid.
	 * @throws				When comparator is not a function.
	 */
	constructor(
		comparator: RedBlackTreeComparator<ItemT>,
		data?: ItemT[] | null,
		options?: RedBlackTreeOptions<ItemT> | null
	) {
		if (typeof comparator !== 'function') {
			throw new Error('RedBlackTree requires a comparator function');
		}

		this.comparator = comparator;
		this.allowDuplicates = booleanValue(true, options?.allowDuplicates);
		this._root = null;
		this._size = 0;
		this.lastLinkId = 0;
		// The element class is generic and the pool builds blank nodes with no
		// value, so any ItemT instantiation is valid here.
		this.elements = new ElementPool(
			RedBlackTreeElement as ObjectPoolConstructor<RedBlackTreeElement<ItemT>>,
			options
		);

		if (Array.isArray(data)) {
			this.insertArray(data);
		}
	}

	/**
	 * Iterate items in sorted order, smallest first.
	 */
	[Symbol.iterator](): RedBlackTreeIterator<ItemT> {
		return new RedBlackTreeIterator<ItemT>(this);
	}

	/**
	 * Insert item at its sorted position, after any items comparing equal,
	 * then rebalance in O(log n).
	 * @returns		The node now holding item, or `duplicate_not_allowed` when
	 * 				item compares equal to one already in the tree and
	 * 				duplicates are not allowed. Nothing is added in that case.
	 */
	public insert(item: ItemT): RedBlackTreeElement<ItemT> | RedBlackTreeError {
		let parent: RedBlackTreeElement<ItemT> | null = null;
		let curr = this._root;
		let goLeft = false;

		while (curr) {
			const result = this.comparator(item, curr._value as ItemT);

			if (result === 0 && !this.allowDuplicates) {
				return 'duplicate_not_allowed';
			}

			parent = curr;
			goLeft = result < 0;
			curr = goLeft ? curr._left : curr._right;
		}

		// Allocated only once the item is known to be accepted.
		const node = this.createElement(item);
		node._parent = parent;
		node._color = 'red';

		if (!parent) {
			this._root = node;
		} else if (goLeft) {
			parent._left = node;
		} else {
			parent._right = node;
		}

		++this._size;
		this.insertFixup(node);

		return node;
	}

	/**
	 * Insert each provided item, in array order. When duplicates are not
	 * allowed, items comparing equal to one already in the tree are skipped.
	 */
	public insertArray(items?: ItemT[] | null): void {
		if (!Array.isArray(items)) {
			return;
		}

		for (const item of items) {
			this.insert(item);
		}
	}

	/**
	 * Find the node holding an item that compares equal to item. When several
	 * do, returns the first in sorted order (the earliest inserted).
	 * @returns		Matching node, or null when no item compares equal.
	 */
	public find(item: ItemT): RedBlackTreeElement<ItemT> | null {
		let curr = this._root;
		let match: RedBlackTreeElement<ItemT> | null = null;

		while (curr) {
			const result = this.comparator(item, curr._value as ItemT);

			// Equal items may also sit in the left subtree, so keep going left
			// to reach the first one in sorted order.
			if (result === 0) {
				match = curr;
				curr = curr._left;
			} else {
				curr = result < 0 ? curr._left : curr._right;
			}
		}

		return match;
	}

	/**
	 * Check whether any item in the tree compares equal to item.
	 */
	public contains(item: ItemT): boolean {
		return this.find(item) !== null;
	}

	/**
	 * Remove one item comparing equal to item: the one `find()` returns.
	 * @returns		The removed item as stored in the tree, or null when no item
	 * 				compares equal.
	 */
	public remove(item: ItemT): ItemT | null {
		return this.removeNode(this.find(item));
	}

	/**
	 * Unlink node from the tree, rebalance, and return its value in O(log n).
	 * Other nodes keep their items. With pooling on, the node is recycled and
	 * must not be used afterwards.
	 * @returns		The removed value, or null when node is null or not part of
	 * 				this tree (including a node that was already removed).
	 */
	public removeNode(node: RedBlackTreeElement<ItemT> | null): ItemT | null {
		if (!node || !this.isPartOfTree(node)) {
			return null;
		}

		const value = node._value as ItemT;
		const left = node._left;
		const right = node._right;
		// Color of the node that leaves its position, and the child moving into
		// that position along with its new parent. The child may be null, so its
		// parent is tracked separately.
		let removedColor = node._color;
		let child: RedBlackTreeElement<ItemT> | null;
		let childParent: RedBlackTreeElement<ItemT> | null;

		if (!left) {
			child = right;
			childParent = node._parent;
			this.transplant(node, right);
		} else if (!right) {
			child = left;
			childParent = node._parent;
			this.transplant(node, left);
		} else {
			// Two children: the in-order successor takes node's place and color,
			// so the successor's old position is the one that loses a node.
			const successor = this.subtreeMin(right);
			removedColor = successor._color;
			child = successor._right;

			if (successor._parent === node) {
				childParent = successor;
			} else {
				childParent = successor._parent;
				this.transplant(successor, successor._right);
				successor._right = right;
				right._parent = successor;
			}

			this.transplant(node, successor);
			successor._left = left;
			left._parent = successor;
			successor._color = node._color;
		}

		if (removedColor === 'black') {
			this.removeFixup(child, childParent);
		}

		this._size--;
		this.unlink(node);
		this.elements.release(node);

		return value;
	}

	/**
	 * Set node's item and keep the tree ordered. For an item changed in place,
	 * pass the node's own item: `tree.update(node, node.value())`. When item
	 * still belongs at node's position, nothing moves. Otherwise node is
	 * removed and item inserted again as a new element. Both take O(log n).
	 *
	 * @returns		The node now holding item: node itself when it stayed in
	 * 				place, otherwise the new element, and node must not be used
	 * 				again. `duplicate_not_allowed` when item now compares equal
	 * 				to another item and duplicates are not allowed: node is
	 * 				removed and item is no longer in the tree. Null when node is
	 * 				null or not part of this tree; nothing changes then.
	 */
	public update(
		node: RedBlackTreeElement<ItemT> | null,
		item: ItemT
	): RedBlackTreeElement<ItemT> | RedBlackTreeError | null {
		if (!node || !this.isPartOfTree(node)) {
			return null;
		}

		node._value = item;

		if (!this.positionValid(node)) {
			this.removeNode(node);
			return this.insert(item);
		}

		if (!this.allowDuplicates && this.hasEqualNeighbor(node)) {
			this.removeNode(node);
			return 'duplicate_not_allowed';
		}

		return node;
	}

	/**
	 * Get the topmost node if one exists.
	 * @returns		Root node, or null when the tree is empty.
	 */
	public root(): RedBlackTreeElement<ItemT> | null {
		return this._root;
	}

	/**
	 * Node holding the smallest item. When several items compare equal, the
	 * first inserted.
	 * @returns		Leftmost node, or null when the tree is empty.
	 */
	public min(): RedBlackTreeElement<ItemT> | null {
		return this._root ? this.subtreeMin(this._root) : null;
	}

	/**
	 * Node holding the largest item. When several items compare equal, the
	 * last inserted.
	 * @returns		Rightmost node, or null when the tree is empty.
	 */
	public max(): RedBlackTreeElement<ItemT> | null {
		return this._root ? this.subtreeMax(this._root) : null;
	}

	/**
	 * Node after node in sorted order.
	 * @returns		Next node, or null when node is the last, is null, or is not
	 * 				part of this tree.
	 */
	public successor(node: RedBlackTreeElement<ItemT> | null): RedBlackTreeElement<ItemT> | null {
		if (!node || !this.isPartOfTree(node)) {
			return null;
		}

		if (node._right) {
			return this.subtreeMin(node._right);
		}

		let curr = node;
		let parent = node._parent;

		while (parent && curr === parent._right) {
			curr = parent;
			parent = parent._parent;
		}

		return parent;
	}

	/**
	 * Node before node in sorted order.
	 * @returns		Previous node, or null when node is the first, is null, or is
	 * 				not part of this tree.
	 */
	public predecessor(node: RedBlackTreeElement<ItemT> | null): RedBlackTreeElement<ItemT> | null {
		if (!node || !this.isPartOfTree(node)) {
			return null;
		}

		if (node._left) {
			return this.subtreeMax(node._left);
		}

		let curr = node;
		let parent = node._parent;

		while (parent && curr === parent._left) {
			curr = parent;
			parent = parent._parent;
		}

		return parent;
	}

	/**
	 * Get number of items in the tree.
	 * @returns		Tree size as a positive integer, or 0 if empty.
	 */
	public size(): number {
		return this._size;
	}

	/**
	 * Quickly check whether the tree has items.
	 */
	public isEmpty(): boolean {
		return this._size === 0;
	}

	/**
	 * Number of edges on the longest root to leaf path, found with a level
	 * order walk in O(n). Never more than 2 log2(n + 1).
	 * @returns		Height, 0 for a lone root, or -1 when the tree is empty.
	 */
	public height(): number {
		let level: RedBlackTreeElement<ItemT>[] = this._root ? [this._root] : [];
		let height = -1;

		while (level.length > 0) {
			const next: RedBlackTreeElement<ItemT>[] = [];

			for (const node of level) {
				if (node._left) {
					next.push(node._left);
				}
				if (node._right) {
					next.push(node._right);
				}
			}

			level = next;
			height++;
		}

		return height;
	}

	/**
	 * Number of edges between node and the root, in O(log n).
	 * @returns		Depth, 0 for the root, or null when node is null or not part
	 * 				of this tree.
	 */
	public depth(node: RedBlackTreeElement<ItemT> | null): number | null {
		if (!node || !this.isPartOfTree(node)) {
			return null;
		}

		let depth = 0;
		let curr = node._parent;

		while (curr) {
			depth++;
			curr = curr._parent;
		}

		return depth;
	}

	/**
	 * Number of black nodes on every path from the root down to a missing
	 * child, counting the root. The same on every path, so found in O(log n)
	 * by walking the left spine.
	 * @returns		Black height, or 0 when the tree is empty.
	 */
	public blackHeight(): number {
		let height = 0;
		let curr = this._root;

		while (curr) {
			if (curr._color === 'black') {
				height++;
			}

			curr = curr._left;
		}

		return height;
	}

	/**
	 * Create a new tree containing only the items of elements for which func
	 * returns true. The new tree uses this tree's comparator and options, and
	 * is built balanced and colored in O(n), since the items arrive already
	 * sorted.
	 * @param func		Called with (element, index, tree) in sorted order.
	 * @param thisArg	Value used as `this` when calling func, as passed. Like
	 * 					`Array.prototype.filter`, `this` is undefined when omitted.
	 */
	public filter(func: RedBlackTreeMethod<ItemT, boolean>, thisArg?: unknown): RedBlackTree<ItemT> {
		const tree = new RedBlackTree<ItemT>(this.comparator, null, this.options());
		tree.insertSorted(this.filterValues(func, thisArg));

		return tree;
	}

	/**
	 * Items of elements for which func returns true, in sorted order.
	 * Subclasses build their own `filter()` result from this.
	 */
	protected filterValues(func: RedBlackTreeMethod<ItemT, boolean>, thisArg?: unknown): ItemT[] {
		const values: ItemT[] = [];

		this.forEach((elem, idx, tree) => {
			if (func.call(thisArg, elem, idx, tree)) {
				values.push(elem._value as ItemT);
			}
		});

		return values;
	}

	/**
	 * Fill an empty tree from items already in this tree's sorted order,
	 * linking them into a balanced, validly colored shape with the same
	 * in-order sequence. Falls back to plain inserts when the tree is not
	 * empty.
	 */
	protected insertSorted(items: ItemT[]): void {
		if (!this.isEmpty()) {
			this.insertArray(items);
			return;
		}

		const count = items.length;
		// Splitting at the middle fills every level except possibly the deepest.
		// Coloring only the deepest level red keeps every path's black count
		// equal. A full bottom level is left black, as is a lone root.
		const deepest = count > 0 ? Math.floor(Math.log2(count)) : 0;
		const full = Number.isInteger(Math.log2(count + 1));
		const redDepth = full ? -1 : deepest;

		this._root = this.buildBalanced(items, 0, count - 1, null, 0, redDepth);
		this._size = count;
	}

	/**
	 * Options equivalent to the ones this tree was built with, for creating
	 * derived trees that behave the same way.
	 */
	protected options(): RedBlackTreeOptions<ItemT> {
		return {...this.elements.options(), allowDuplicates: this.allowDuplicates};
	}

	/**
	 * Call func for each element in sorted order, by following successor
	 * links. No array of elements is built, so the traversal itself allocates
	 * nothing.
	 *
	 * @remarks
	 * Like `Map` / `Set`, func receives the tree itself as its third argument,
	 * not an array. Each element's successor is found before func runs, so func
	 * may remove the current element. Removal only relinks nodes, so the
	 * remaining walk still visits every other element. Elements inserted
	 * during the walk may or may not be visited.
	 *
	 * @param func		Called with (element, index, tree) in sorted order.
	 * @param thisArg	Value used as `this` when calling func, as passed. Like
	 * 					`Array.prototype.forEach`, `this` is undefined when omitted.
	 */
	public forEach(func: RedBlackTreeMethod<ItemT, void>, thisArg?: unknown): RedBlackTree<ItemT> {
		let node = this.min();
		let index = 0;

		while (node) {
			const next = this.successor(node);
			func.call(thisArg, node, index, this);
			node = next;
			index++;
		}

		return this;
	}

	/**
	 * Every item in sorted order. Same as `inOrder()`.
	 */
	public values(): ItemT[] {
		return this.inOrder();
	}

	/**
	 * Every item in sorted order: left subtree, node, right subtree.
	 */
	public inOrder(): ItemT[] {
		return this.toArray().map((node) => node._value as ItemT);
	}

	/**
	 * Every item with each node before its subtrees: node, left, right.
	 */
	public preOrder(): ItemT[] {
		const values: ItemT[] = [];
		const stack: RedBlackTreeElement<ItemT>[] = this._root ? [this._root] : [];

		while (stack.length > 0) {
			const node = stack.pop() as RedBlackTreeElement<ItemT>;
			values.push(node._value as ItemT);

			if (node._right) {
				stack.push(node._right);
			}
			if (node._left) {
				stack.push(node._left);
			}
		}

		return values;
	}

	/**
	 * Every item with each node after its subtrees: left, right, node.
	 */
	public postOrder(): ItemT[] {
		// Walk node, right, left, then reverse to get left, right, node.
		const values: ItemT[] = [];
		const stack: RedBlackTreeElement<ItemT>[] = this._root ? [this._root] : [];

		while (stack.length > 0) {
			const node = stack.pop() as RedBlackTreeElement<ItemT>;
			values.push(node._value as ItemT);

			if (node._left) {
				stack.push(node._left);
			}
			if (node._right) {
				stack.push(node._right);
			}
		}

		return values.reverse();
	}

	/**
	 * Every item level by level from the root, left to right within a level.
	 */
	public levelOrder(): ItemT[] {
		const values: ItemT[] = [];
		const queue: RedBlackTreeElement<ItemT>[] = this._root ? [this._root] : [];

		for (let i = 0; i < queue.length; i++) {
			const node = queue[i];
			values.push(node._value as ItemT);

			if (node._left) {
				queue.push(node._left);
			}
			if (node._right) {
				queue.push(node._right);
			}
		}

		return values;
	}

	/**
	 * Serialize tree items, in sorted order, to a JSON string.
	 * @returns		JSON string, or null when an item cannot be serialized
	 * 				(e.g. items contain circular references or BigInt values).
	 */
	public stringify(): string | null {
		try {
			return JSON.stringify({type: 'RedBlackTree', elements: this.values()});
		} catch {
			return null;
		}
	}

	/**
	 * Every node, in sorted order.
	 */
	public toArray(): RedBlackTreeElement<ItemT>[] {
		const result: RedBlackTreeElement<ItemT>[] = [];

		let node = this.min();

		while (node) {
			result.push(node);
			node = this.successor(node);
		}

		return result;
	}

	/**
	 * Find elements whose items pass every filter, in sorted order. Each
	 * result's `delete()` removes its element, and does nothing once that
	 * element has been removed some other way.
	 */
	public query(
		filters: QueryFilter<ItemT> | QueryFilter<ItemT>[],
		opts?: QueryOptions
	): QueryResult<RedBlackTreeElement<ItemT>, ItemT>[] {
		const resultsArray: QueryResult<RedBlackTreeElement<ItemT>, ItemT>[] = [];
		const options = this.queryOptions(opts);
		let node = this.min();

		// Stops walking as soon as the limit is reached.
		while (node && resultsArray.length < options.limit) {
			const element = node;
			const value = element._value as ItemT;
			node = this.successor(element);

			const take = Array.isArray(filters)
				? filters.length > 0 && filters.every((filter) => filter(value))
				: filters(value);

			if (!take) {
				continue;
			}

			resultsArray.push({
				element: element,
				key: (): string | null => null,
				index: (): number | null => null,
				delete: this.queryDelete.bind(this, element, element._linkId)
			});
		}

		return resultsArray;
	}

	/**
	 * Unlink and drop every element. Elements removed this way have their
	 * links cleared, and are recycled when pooling is on.
	 */
	public clearElements(): RedBlackTree<ItemT> {
		const nodes = this.toArray();

		for (const node of nodes) {
			this.unlink(node);
		}

		this._root = null;
		this._size = 0;
		this.elements.releaseAll(nodes);

		return this;
	}

	/**
	 * Restore the tree to its freshly constructed state. The comparator and
	 * constructor options are kept.
	 */
	public reset(): RedBlackTree<ItemT> {
		this.clearElements();

		return this;
	}

	/**
	 * Blank node from the element pool, filled with item and claimed by this
	 * tree under a fresh link id. The caller links and colors it.
	 */
	private createElement(item: ItemT): RedBlackTreeElement<ItemT> {
		const node = this.elements.allocate();
		node._value = item;
		node._tree = this;
		node._linkId = ++this.lastLinkId;

		return node;
	}

	/**
	 * Link items[first..last] into a subtree under parent and return its root.
	 * Each subtree is topped by its middle item, so recursion depth is
	 * O(log n). Nodes at redDepth are red and all others black.
	 */
	private buildBalanced(
		items: ItemT[],
		first: number,
		last: number,
		parent: RedBlackTreeElement<ItemT> | null,
		depth: number,
		redDepth: number
	): RedBlackTreeElement<ItemT> | null {
		if (first > last) {
			return null;
		}

		const middle = first + Math.floor((last - first) / 2);
		const node = this.createElement(items[middle]);
		node._parent = parent;
		node._color = depth === redDepth ? 'red' : 'black';
		node._left = this.buildBalanced(items, first, middle - 1, node, depth + 1, redDepth);
		node._right = this.buildBalanced(items, middle + 1, last, node, depth + 1, redDepth);

		return node;
	}

	/**
	 * Restore the red-black rules after linking red node as a leaf. Only a
	 * red node with a red parent can break them. A red uncle is pushed up by
	 * recoloring, moving the problem two levels higher. A black or missing
	 * uncle is fixed for good with one or two rotations.
	 */
	private insertFixup(node: RedBlackTreeElement<ItemT>): void {
		let curr = node;

		while (curr._parent && curr._parent._color === 'red') {
			let parent = curr._parent;
			// A red parent is never the root, so the grandparent exists.
			const grandparent = parent._parent as RedBlackTreeElement<ItemT>;

			if (parent === grandparent._left) {
				const uncle = grandparent._right;

				if (this.isRed(uncle)) {
					parent._color = 'black';
					uncle!._color = 'black';
					grandparent._color = 'red';
					curr = grandparent;
					continue;
				}

				if (curr === parent._right) {
					this.rotateLeft(parent);
					curr = parent;
					parent = curr._parent as RedBlackTreeElement<ItemT>;
				}

				parent._color = 'black';
				grandparent._color = 'red';
				this.rotateRight(grandparent);
			} else {
				const uncle = grandparent._left;

				if (this.isRed(uncle)) {
					parent._color = 'black';
					uncle!._color = 'black';
					grandparent._color = 'red';
					curr = grandparent;
					continue;
				}

				if (curr === parent._left) {
					this.rotateRight(parent);
					curr = parent;
					parent = curr._parent as RedBlackTreeElement<ItemT>;
				}

				parent._color = 'black';
				grandparent._color = 'red';
				this.rotateLeft(grandparent);
			}
		}

		(this._root as RedBlackTreeElement<ItemT>)._color = 'black';
	}

	/**
	 * Restore the red-black rules after a black node left the position now
	 * held by child, which may be null. Paths through child are one black node
	 * short. A red child simply turns black. Otherwise the sibling's subtree
	 * gives up a black node by recoloring, which moves the shortage up to the
	 * parent, or by one to three rotations, which end it.
	 */
	private removeFixup(
		child: RedBlackTreeElement<ItemT> | null,
		childParent: RedBlackTreeElement<ItemT> | null
	): void {
		let curr = child;
		let parent = childParent;

		while (curr !== this._root && !this.isRed(curr)) {
			// curr is not the root, so it has a parent.
			const currParent = parent as RedBlackTreeElement<ItemT>;

			if (curr === currParent._left) {
				// curr's side is a black node short, so the sibling exists.
				let sibling = currParent._right as RedBlackTreeElement<ItemT>;

				if (sibling._color === 'red') {
					sibling._color = 'black';
					currParent._color = 'red';
					this.rotateLeft(currParent);
					sibling = currParent._right as RedBlackTreeElement<ItemT>;
				}

				if (!this.isRed(sibling._left) && !this.isRed(sibling._right)) {
					sibling._color = 'red';
					curr = currParent;
					parent = currParent._parent;
					continue;
				}

				if (!this.isRed(sibling._right)) {
					(sibling._left as RedBlackTreeElement<ItemT>)._color = 'black';
					sibling._color = 'red';
					this.rotateRight(sibling);
					sibling = currParent._right as RedBlackTreeElement<ItemT>;
				}

				sibling._color = currParent._color;
				currParent._color = 'black';
				(sibling._right as RedBlackTreeElement<ItemT>)._color = 'black';
				this.rotateLeft(currParent);
			} else {
				let sibling = currParent._left as RedBlackTreeElement<ItemT>;

				if (sibling._color === 'red') {
					sibling._color = 'black';
					currParent._color = 'red';
					this.rotateRight(currParent);
					sibling = currParent._left as RedBlackTreeElement<ItemT>;
				}

				if (!this.isRed(sibling._left) && !this.isRed(sibling._right)) {
					sibling._color = 'red';
					curr = currParent;
					parent = currParent._parent;
					continue;
				}

				if (!this.isRed(sibling._left)) {
					(sibling._right as RedBlackTreeElement<ItemT>)._color = 'black';
					sibling._color = 'red';
					this.rotateLeft(sibling);
					sibling = currParent._left as RedBlackTreeElement<ItemT>;
				}

				sibling._color = currParent._color;
				currParent._color = 'black';
				(sibling._left as RedBlackTreeElement<ItemT>)._color = 'black';
				this.rotateRight(currParent);
			}

			curr = this._root;
			break;
		}

		if (curr) {
			curr._color = 'black';
		}
	}

	/**
	 * Lift node's right child into node's place, making node its left child.
	 * In-order sequence is unchanged. node must have a right child.
	 */
	private rotateLeft(node: RedBlackTreeElement<ItemT>): void {
		const pivot = node._right as RedBlackTreeElement<ItemT>;

		node._right = pivot._left;
		if (pivot._left) {
			pivot._left._parent = node;
		}

		this.transplant(node, pivot);
		pivot._left = node;
		node._parent = pivot;
	}

	/**
	 * Lift node's left child into node's place, making node its right child.
	 * In-order sequence is unchanged. node must have a left child.
	 */
	private rotateRight(node: RedBlackTreeElement<ItemT>): void {
		const pivot = node._left as RedBlackTreeElement<ItemT>;

		node._left = pivot._right;
		if (pivot._right) {
			pivot._right._parent = node;
		}

		this.transplant(node, pivot);
		pivot._right = node;
		node._parent = pivot;
	}

	/** Missing children count as black. */
	private isRed(node: RedBlackTreeElement<ItemT> | null): boolean {
		return node !== null && node._color === 'red';
	}

	/**
	 * Put replacement (or nothing) where target hangs from its parent. Leaves
	 * target's own links for the caller to fix.
	 */
	private transplant(
		target: RedBlackTreeElement<ItemT>,
		replacement: RedBlackTreeElement<ItemT> | null
	): void {
		const parent = target._parent;

		if (!parent) {
			this._root = replacement;
		} else if (target === parent._left) {
			parent._left = replacement;
		} else {
			parent._right = replacement;
		}

		if (replacement) {
			replacement._parent = parent;
		}
	}

	/**
	 * Check that node's item still fits where node sits, assuming every other
	 * node is correctly placed. Items are in sorted order along the in-order
	 * walk, so comparing against the neighbors on each side is enough. O(log n).
	 */
	private positionValid(node: RedBlackTreeElement<ItemT>): boolean {
		const value = node._value as ItemT;
		const prev = this.predecessor(node);
		const next = this.successor(node);

		return (
			(prev === null || this.comparator(prev._value as ItemT, value) <= 0) &&
			(next === null || this.comparator(value, next._value as ItemT) <= 0)
		);
	}

	/**
	 * Whether an item next to node in sorted order compares equal to node's.
	 * Only meaningful for a correctly placed node, where every equal item is
	 * adjacent to it.
	 */
	private hasEqualNeighbor(node: RedBlackTreeElement<ItemT>): boolean {
		const value = node._value as ItemT;
		const prev = this.predecessor(node);
		const next = this.successor(node);

		return (
			(prev !== null && this.comparator(prev._value as ItemT, value) === 0) ||
			(next !== null && this.comparator(next._value as ItemT, value) === 0)
		);
	}

	private subtreeMin(node: RedBlackTreeElement<ItemT>): RedBlackTreeElement<ItemT> {
		let curr = node;

		while (curr._left) {
			curr = curr._left;
		}

		return curr;
	}

	private subtreeMax(node: RedBlackTreeElement<ItemT>): RedBlackTreeElement<ItemT> {
		let curr = node;

		while (curr._right) {
			curr = curr._right;
		}

		return curr;
	}

	/**
	 * Clear node's links, color, and ownership. Needed even when pooling is
	 * off, where release does not blank the node.
	 */
	private unlink(node: RedBlackTreeElement<ItemT>): void {
		node._left = null;
		node._right = null;
		node._parent = null;
		node._color = 'red';
		node._tree = null;
		node._linkId = 0;
	}

	private isPartOfTree(node: RedBlackTreeElement<ItemT>): boolean {
		return node._tree === this;
	}

	/**
	 * Remove a query match, but only while element still holds the item it
	 * matched. A recycled element reissued to a later insert carries a new
	 * link id, so a stale result deletes nothing instead of the new item.
	 */
	private queryDelete(element: RedBlackTreeElement<ItemT>, linkId: number): ItemT | null {
		if (element._linkId !== linkId) {
			return null;
		}

		return this.removeNode(element);
	}

	private queryOptions(opts?: QueryOptions): Required<QueryOptions> {
		const options: Required<QueryOptions> = {
			limit: Infinity
		};

		if (opts?.limit && isNumber(opts.limit) && opts.limit >= 1) {
			options.limit = Math.round(opts.limit);
		}

		return options;
	}
}
