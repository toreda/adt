import type {OctTree} from '../tree';
import type {OctTreeOctant} from './octant';
import {type ObjectPoolInstance} from '../../object/pool/instance';
import {type TreeElement} from '../../tree/element';

/**
 * Node wrapping one item in an `OctTree`. Implements `ObjectPoolInstance` so
 * the tree can recycle nodes through an internal `ObjectPool`. Links and
 * position are read-only from outside: only the tree rewires or moves nodes,
 * since any other change could break its spatial order.
 *
 * @category Oct Tree
 */
export class OctTreeElement<T> implements TreeElement<T>, ObjectPoolInstance {
	/**
	 * Item held by this node. Managed by `OctTree` only; a linked node always
	 * holds exactly the item that was inserted, including null or undefined
	 * items.
	 */
	public _value: T | null = null;
	/**
	 * Position the item was filed under, read from the locator when the node
	 * was linked. Managed by `OctTree` only. Every walk reads these instead of
	 * calling the locator, so an item changed in place cannot break the tree.
	 */
	public _x: number = 0;
	public _y: number = 0;
	public _z: number = 0;
	public _parent: OctTreeElement<T> | null = null;
	/** Child per octant, indexed by `OctTreeOctant`. Always eight entries. */
	public readonly _children: (OctTreeElement<T> | null)[] = [
		null,
		null,
		null,
		null,
		null,
		null,
		null,
		null
	];
	/** Octant of `_parent` this node sits in. 0 for the root and unlinked nodes. */
	public _octant: OctTreeOctant = 0;
	/**
	 * Tree this node is currently linked into, or null when unlinked. Managed
	 * by `OctTree` only; lets it check ownership in O(1).
	 */
	public _tree: OctTree<T> | null = null;
	/**
	 * Id of the insert that linked this node, unique within `_tree`, or 0 when
	 * unlinked. Managed by `OctTree` only. A recycled node gets a new id, so a
	 * handle that captured the old one can tell the node was reissued.
	 */
	public _linkId: number = 0;

	/**
	 * @param element	Initial value. Omitted when constructed by an `ObjectPool`,
	 * 					which hands out blank nodes for the tree to fill.
	 */
	constructor(element?: T) {
		if (element !== undefined) {
			this._value = element;
		}
	}

	/**
	 * Reset every field to its blank state. Called by `ObjectPool` on release
	 * so a recycled node never carries a previous item or its links. Any new
	 * field added to this class must be cleared here.
	 */
	public cleanObj(): void {
		this._value = null;
		this._x = 0;
		this._y = 0;
		this._z = 0;
		this._parent = null;

		for (let octant = 0; octant < 8; octant++) {
			this._children[octant] = null;
		}

		this._octant = 0;
		this._tree = null;
		this._linkId = 0;
	}

	/**
	 * Get the node's value, or set it when elementValue is provided.
	 *
	 * @remarks
	 * While the node is linked into a tree, a new value is only accepted when
	 * the tree's locator places it at exactly the node's position (e.g.
	 * replacing an item with an updated copy that has not moved). Any other
	 * value would break the spatial order, so it is ignored: use the tree's
	 * `update()` instead, which moves the node when needed.
	 */
	public value(elementValue?: T): T | null {
		if (typeof elementValue === 'undefined') {
			return this._value;
		}

		if (this._tree === null) {
			this._value = elementValue;
			return null;
		}

		const point = this._tree.locator(elementValue);

		if (point && point.x === this._x && point.y === this._y && point.z === this._z) {
			this._value = elementValue;
		}

		return null;
	}

	/** X coordinate the tree filed this node under. */
	public x(): number {
		return this._x;
	}

	/** Y coordinate the tree filed this node under. */
	public y(): number {
		return this._y;
	}

	/** Z coordinate the tree filed this node under. */
	public z(): number {
		return this._z;
	}

	/** Octant of the parent this node sits in. 0 for the root. */
	public octant(): OctTreeOctant {
		return this._octant;
	}

	/**
	 * Child in the given octant.
	 * @returns		Child node, or null when that octant is empty or octant is
	 * 				not a valid `OctTreeOctant`.
	 */
	public child(octant: OctTreeOctant): OctTreeElement<T> | null {
		const child = this._children[octant];

		return child !== undefined ? child : null;
	}

	public parent(): OctTreeElement<T> | null {
		return this._parent;
	}

	/**
	 * Existing children, in octant order. Allocates a new array unless out is
	 * given; on a hot path, use `child(octant)`, which allocates nothing.
	 * @param out	Optional array to fill instead. Its previous contents are
	 * 				replaced and its length set to the child count. The array
	 * 				object is reused, but V8 shrinks its storage when the length
	 * 				drops, so a later call with more children can allocate
	 * 				storage again. For zero allocation use `child(octant)`.
	 * @returns		out when given, otherwise a new array.
	 */
	public children(out?: OctTreeElement<T>[] | null): OctTreeElement<T>[] {
		const result: OctTreeElement<T>[] = Array.isArray(out) ? out : [];
		let count = 0;

		for (let octant = 0; octant < 8; octant++) {
			const child = this._children[octant];

			if (child) {
				result[count++] = child;
			}
		}

		result.length = count;

		return result;
	}

	public isLeaf(): boolean {
		for (let octant = 0; octant < 8; octant++) {
			if (this._children[octant]) {
				return false;
			}
		}

		return true;
	}
}
