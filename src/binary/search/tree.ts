import type {BinarySearchTreeComparator} from './tree/comparator';
import {BinarySearchTreeElement} from './tree/element';
import type {BinarySearchTreeError} from './tree/error';
import {BinarySearchTreeIterator} from './tree/iterator';
import type {BinarySearchTreeMethod} from './tree/method';
import type {BinarySearchTreeOptions} from './tree/options';
import {ElementPool} from '../../element/pool';
import type {ObjectPoolConstructor} from '../../object/pool/constructor';
import type {QueryFilter} from '../../query/filter';
import type {QueryOptions} from '../../query/options';
import type {QueryResult} from '../../query/result';
import type {Tree} from '../../tree';
import {booleanValue} from '../../boolean/value';
import {isNumber} from '../../utility';

/**
 * Unbalanced binary search tree ordered by a caller supplied comparator. Every
 * node's left subtree holds smaller items and its right subtree holds equal or
 * larger items, so an in-order walk visits items in sorted order.
 *
 * Search, insert, and removal take O(h), where h is the tree's height: O(log n)
 * on average for items inserted in random order, O(n) when items arrive
 * already sorted. Every walk is iterative, so a degenerate tree never
 * overflows the call stack.
 *
 * Node wrappers are pooled by default (see `DataStructureOptions`). Removal relinks
 * nodes instead of copying values between them, so a node handed out by
 * `insert()` keeps holding its item until that item is removed.
 *
 * @remarks
 * Duplicates are allowed by default, as in the textbook BST: an item comparing
 * equal to existing ones is placed after them, so equal items keep their
 * insertion order in every sorted walk. With `allowDuplicates: false`, adding
 * a duplicate adds nothing and returns an error code instead of throwing.
 *
 * The tree cannot see changes made to an item after it was inserted. After
 * changing anything the comparator reads, call `update()` so the item is moved
 * if its position is no longer valid.
 *
 * @category Binary Search Tree
 */
export class BinarySearchTree<ItemT> implements Tree<ItemT, BinarySearchTreeElement<ItemT>> {
	/** Orders items. Required at construction, fixed for the tree's lifetime. */
	public readonly comparator: BinarySearchTreeComparator<ItemT>;
	/** Whether items comparing equal to one already in the tree are accepted. */
	public readonly allowDuplicates: boolean;
	private _root: BinarySearchTreeElement<ItemT> | null;
	private _size: number;
	/** Last id handed to a linked node. Only increases, so ids never repeat. */
	private lastLinkId: number;
	/** Source of node wrappers, pooled or freshly allocated per options. */
	private readonly elements: ElementPool<BinarySearchTreeElement<ItemT>>;

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
		comparator: BinarySearchTreeComparator<ItemT>,
		data?: ItemT[] | null,
		options?: BinarySearchTreeOptions<ItemT> | null
	) {
		if (typeof comparator !== 'function') {
			throw new Error('BinarySearchTree requires a comparator function');
		}

		this.comparator = comparator;
		this.allowDuplicates = booleanValue(true, options?.allowDuplicates);
		this._root = null;
		this._size = 0;
		this.lastLinkId = 0;
		// The element class is generic and the pool builds blank nodes with no
		// value, so any ItemT instantiation is valid here.
		this.elements = new ElementPool(
			BinarySearchTreeElement as ObjectPoolConstructor<BinarySearchTreeElement<ItemT>>,
			options
		);

		if (Array.isArray(data)) {
			this.insertArray(data);
		}
	}

	/**
	 * Iterate items in sorted order, smallest first.
	 */
	[Symbol.iterator](): BinarySearchTreeIterator<ItemT> {
		return new BinarySearchTreeIterator<ItemT>(this);
	}

	/**
	 * Insert item at its sorted position, after any items comparing equal.
	 * @returns		The node now holding item, or `duplicate_not_allowed` when
	 * 				item compares equal to one already in the tree and
	 * 				duplicates are not allowed. Nothing is added in that case.
	 */
	public insert(item: ItemT): BinarySearchTreeElement<ItemT> | BinarySearchTreeError {
		let parent: BinarySearchTreeElement<ItemT> | null = null;
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

		if (!parent) {
			this._root = node;
		} else if (goLeft) {
			parent._left = node;
		} else {
			parent._right = node;
		}

		++this._size;
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
	public find(item: ItemT): BinarySearchTreeElement<ItemT> | null {
		let curr = this._root;

		while (curr) {
			const result = this.comparator(item, curr._value as ItemT);

			if (result === 0) {
				return curr;
			}

			curr = result < 0 ? curr._left : curr._right;
		}

		return null;
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
	 * Unlink node from the tree and return its value in O(h). Other nodes keep
	 * their items. With pooling on, the node is recycled and must not be used
	 * afterwards.
	 * @returns		The removed value, or null when node is null or not part of
	 * 				this tree (including a node that was already removed).
	 */
	public removeNode(node: BinarySearchTreeElement<ItemT> | null): ItemT | null {
		if (!node || !this.isPartOfTree(node)) {
			return null;
		}

		const value = node._value as ItemT;
		const left = node._left;
		const right = node._right;

		if (!left) {
			this.transplant(node, right);
		} else if (!right) {
			this.transplant(node, left);
		} else {
			// Two children: the in-order successor takes node's place.
			const successor = this.subtreeMin(right);

			if (successor._parent !== node) {
				this.transplant(successor, successor._right);
				successor._right = right;
				right._parent = successor;
			}

			this.transplant(node, successor);
			successor._left = left;
			left._parent = successor;
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
	 * removed and item inserted again as a new element. Both take O(h).
	 *
	 * @returns		The node now holding item: node itself when it stayed in
	 * 				place, otherwise the new element, and node must not be used
	 * 				again. `duplicate_not_allowed` when item now compares equal
	 * 				to another item and duplicates are not allowed: node is
	 * 				removed and item is no longer in the tree. Null when node is
	 * 				null or not part of this tree; nothing changes then.
	 */
	public update(
		node: BinarySearchTreeElement<ItemT> | null,
		item: ItemT
	): BinarySearchTreeElement<ItemT> | BinarySearchTreeError | null {
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
	public root(): BinarySearchTreeElement<ItemT> | null {
		return this._root;
	}

	/**
	 * Node holding the smallest item.
	 * @returns		Leftmost node, or null when the tree is empty.
	 */
	public min(): BinarySearchTreeElement<ItemT> | null {
		return this._root ? this.subtreeMin(this._root) : null;
	}

	/**
	 * Node holding the largest item. When several items compare equal, the
	 * last inserted.
	 * @returns		Rightmost node, or null when the tree is empty.
	 */
	public max(): BinarySearchTreeElement<ItemT> | null {
		return this._root ? this.subtreeMax(this._root) : null;
	}

	/**
	 * Node after node in sorted order.
	 * @returns		Next node, or null when node is the last, is null, or is not
	 * 				part of this tree.
	 */
	public successor(node: BinarySearchTreeElement<ItemT> | null): BinarySearchTreeElement<ItemT> | null {
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
	public predecessor(node: BinarySearchTreeElement<ItemT> | null): BinarySearchTreeElement<ItemT> | null {
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
	 * order walk in O(n).
	 * @returns		Height, 0 for a lone root, or -1 when the tree is empty.
	 */
	public height(): number {
		let level: BinarySearchTreeElement<ItemT>[] = this._root ? [this._root] : [];
		let height = -1;

		while (level.length > 0) {
			const next: BinarySearchTreeElement<ItemT>[] = [];

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
	 * Number of edges between node and the root, in O(h).
	 * @returns		Depth, 0 for the root, or null when node is null or not part
	 * 				of this tree.
	 */
	public depth(node: BinarySearchTreeElement<ItemT> | null): number | null {
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
	 * Create a new tree containing only the items of elements for which func
	 * returns true. The new tree uses this tree's comparator and options, and
	 * is built balanced in O(n log n) at worst, since the items arrive already
	 * sorted. Runs of equal items become right chains, as the search order
	 * requires.
	 * @param func		Called with (element, index, tree) in sorted order.
	 * @param thisArg	Value used as `this` when calling func, as passed. Like
	 * 					`Array.prototype.filter`, `this` is undefined when omitted.
	 */
	public filter(func: BinarySearchTreeMethod<ItemT, boolean>, thisArg?: unknown): BinarySearchTree<ItemT> {
		const tree = new BinarySearchTree<ItemT>(this.comparator, null, this.options());
		tree.insertSorted(this.filterValues(func, thisArg));

		return tree;
	}

	/**
	 * Items of elements for which func returns true, in sorted order.
	 * Subclasses build their own `filter()` result from this.
	 */
	protected filterValues(func: BinarySearchTreeMethod<ItemT, boolean>, thisArg?: unknown): ItemT[] {
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
	 * linking them into a balanced shape with the same in-order sequence.
	 * Falls back to plain inserts when the tree is not empty.
	 */
	protected insertSorted(items: ItemT[]): void {
		if (!this.isEmpty()) {
			this.insertArray(items);
			return;
		}

		this._root = this.buildBalanced(items, 0, items.length - 1, null);
		this._size = items.length;
	}

	/**
	 * Options equivalent to the ones this tree was built with, for creating
	 * derived trees that behave the same way.
	 */
	protected options(): BinarySearchTreeOptions<ItemT> {
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
	 * may remove the current element. Elements inserted during the walk may or
	 * may not be visited.
	 *
	 * @param func		Called with (element, index, tree) in sorted order.
	 * @param thisArg	Value used as `this` when calling func, as passed. Like
	 * 					`Array.prototype.forEach`, `this` is undefined when omitted.
	 */
	public forEach(func: BinarySearchTreeMethod<ItemT, void>, thisArg?: unknown): BinarySearchTree<ItemT> {
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
	 * Inserting the result into an empty tree rebuilds the same shape.
	 */
	public preOrder(): ItemT[] {
		const values: ItemT[] = [];
		const stack: BinarySearchTreeElement<ItemT>[] = this._root ? [this._root] : [];

		while (stack.length > 0) {
			const node = stack.pop() as BinarySearchTreeElement<ItemT>;
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
		const stack: BinarySearchTreeElement<ItemT>[] = this._root ? [this._root] : [];

		while (stack.length > 0) {
			const node = stack.pop() as BinarySearchTreeElement<ItemT>;
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
		const queue: BinarySearchTreeElement<ItemT>[] = this._root ? [this._root] : [];

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
			return JSON.stringify({type: 'BinarySearchTree', elements: this.values()});
		} catch {
			return null;
		}
	}

	/**
	 * Every node, in sorted order.
	 */
	public toArray(): BinarySearchTreeElement<ItemT>[] {
		const result: BinarySearchTreeElement<ItemT>[] = [];

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
	): QueryResult<BinarySearchTreeElement<ItemT>, ItemT>[] {
		const resultsArray: QueryResult<BinarySearchTreeElement<ItemT>, ItemT>[] = [];
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
	public clearElements(): BinarySearchTree<ItemT> {
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
	public reset(): BinarySearchTree<ItemT> {
		this.clearElements();

		return this;
	}

	/**
	 * Blank node from the element pool, filled with item and claimed by this
	 * tree under a fresh link id. The caller links it into place.
	 */
	private createElement(item: ItemT): BinarySearchTreeElement<ItemT> {
		const node = this.elements.allocate();
		node._value = item;
		node._tree = this;
		node._linkId = ++this.lastLinkId;

		return node;
	}

	/**
	 * Link items[first..last] into a subtree under parent and return its root.
	 * Each subtree is topped by its middle item, moved left to the first of any
	 * run of equal items so that no equal item lands in a left subtree. Runs of
	 * equal items therefore form right chains, and the tree is balanced apart
	 * from those. Right children are linked in a loop and only left subtrees
	 * recurse, each at most half its parent's range, so recursion depth stays
	 * O(log n) even when every item is equal.
	 */
	private buildBalanced(
		items: ItemT[],
		first: number,
		last: number,
		parent: BinarySearchTreeElement<ItemT> | null
	): BinarySearchTreeElement<ItemT> | null {
		let top: BinarySearchTreeElement<ItemT> | null = null;
		let prev: BinarySearchTreeElement<ItemT> | null = null;

		while (first <= last) {
			const middle = this.firstEqual(items, first, first + Math.floor((last - first) / 2));
			const node = this.createElement(items[middle]);
			node._parent = prev ? prev : parent;
			node._left = this.buildBalanced(items, first, middle - 1, node);

			if (prev) {
				prev._right = node;
			} else {
				top = node;
			}

			prev = node;
			first = middle + 1;
		}

		return top;
	}

	/**
	 * Lowest index in sorted items[first..index] whose item compares equal to
	 * items[index], found by binary search.
	 */
	private firstEqual(items: ItemT[], first: number, index: number): number {
		let low = first;
		let high = index;

		while (low < high) {
			const mid = low + Math.floor((high - low) / 2);

			if (this.comparator(items[mid], items[index]) < 0) {
				low = mid + 1;
			} else {
				high = mid;
			}
		}

		return low;
	}

	/**
	 * Put replacement (or nothing) where target hangs from its parent. Leaves
	 * target's own links for the caller to fix.
	 */
	private transplant(
		target: BinarySearchTreeElement<ItemT>,
		replacement: BinarySearchTreeElement<ItemT> | null
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
	 * node is correctly placed: every item in its left subtree is smaller,
	 * every item in its right subtree is equal or larger, and it falls on the
	 * correct side of each ancestor. O(h).
	 */
	private positionValid(node: BinarySearchTreeElement<ItemT>): boolean {
		const value = node._value as ItemT;

		if (node._left && this.comparator(this.subtreeMax(node._left)._value as ItemT, value) >= 0) {
			return false;
		}

		if (node._right && this.comparator(this.subtreeMin(node._right)._value as ItemT, value) < 0) {
			return false;
		}

		let child = node;
		let parent = node._parent;

		while (parent) {
			const result = this.comparator(value, parent._value as ItemT);

			if (child === parent._left ? result >= 0 : result < 0) {
				return false;
			}

			child = parent;
			parent = parent._parent;
		}

		return true;
	}

	/**
	 * Whether an item next to node in sorted order compares equal to node's.
	 * Only meaningful for a correctly placed node, where every equal item is
	 * adjacent to it.
	 */
	private hasEqualNeighbor(node: BinarySearchTreeElement<ItemT>): boolean {
		const value = node._value as ItemT;
		const prev = this.predecessor(node);
		const next = this.successor(node);

		return (
			(prev !== null && this.comparator(prev._value as ItemT, value) === 0) ||
			(next !== null && this.comparator(next._value as ItemT, value) === 0)
		);
	}

	private subtreeMin(node: BinarySearchTreeElement<ItemT>): BinarySearchTreeElement<ItemT> {
		let curr = node;

		while (curr._left) {
			curr = curr._left;
		}

		return curr;
	}

	private subtreeMax(node: BinarySearchTreeElement<ItemT>): BinarySearchTreeElement<ItemT> {
		let curr = node;

		while (curr._right) {
			curr = curr._right;
		}

		return curr;
	}

	/**
	 * Clear node's links and ownership. Needed even when pooling is off, where
	 * release does not blank the node.
	 */
	private unlink(node: BinarySearchTreeElement<ItemT>): void {
		node._left = null;
		node._right = null;
		node._parent = null;
		node._tree = null;
		node._linkId = 0;
	}

	private isPartOfTree(node: BinarySearchTreeElement<ItemT>): boolean {
		return node._tree === this;
	}

	/**
	 * Remove a query match, but only while element still holds the item it
	 * matched. A recycled element reissued to a later insert carries a new
	 * link id, so a stale result deletes nothing instead of the new item.
	 */
	private queryDelete(element: BinarySearchTreeElement<ItemT>, linkId: number): ItemT | null {
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
