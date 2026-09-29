import type {SpatialGrid} from './grid';
import {type Element} from '../element';
import {type ObjectPoolInstance} from '../object/pool/instance';

/**
 * Element wrapping one item in a `SpatialHash` or `SpatialMap`. Implements
 * `ObjectPoolInstance` so the data structure can recycle elements through an
 * internal `ObjectPool`. Links, position, and cell are read-only from
 * outside: only the data structure rewires or moves elements, since any other
 * change could file an item under the wrong cell.
 *
 * Each element sits on two intrusive doubly linked lists: the items of its
 * cell, and every item of the data structure in insertion order.
 *
 * @category Spatial
 */
export class SpatialElement<T> implements Element<T>, ObjectPoolInstance {
	/**
	 * Item held by this element. Managed by the data structure only; a linked
	 * element always holds exactly the item that was inserted, including null
	 * or undefined items.
	 */
	public _value: T | null = null;
	/**
	 * Position the item was filed under, read from the locator when the element
	 * was linked. Managed by the data structure only. Every query reads these
	 * instead of calling the locator, so an item changed in place cannot break
	 * the data structure.
	 */
	public _x: number = 0;
	public _y: number = 0;
	public _z: number = 0;
	/** Integer coordinates of the cell holding `_x`, `_y`, `_z`. */
	public _cellX: number = 0;
	public _cellY: number = 0;
	public _cellZ: number = 0;
	/** Cell table slot of the element's cell, or -1 when unlinked. */
	public _slot: number = -1;
	/** Neighbors in the element's cell list. */
	public _cellNext: SpatialElement<T> | null = null;
	public _cellPrev: SpatialElement<T> | null = null;
	/** Neighbors in insertion order across the whole data structure. */
	public _next: SpatialElement<T> | null = null;
	public _prev: SpatialElement<T> | null = null;
	/**
	 * Grid this element is currently linked into, or null when unlinked.
	 * Managed by the data structure only; lets it check ownership in O(1).
	 */
	public _grid: SpatialGrid<T> | null = null;
	/**
	 * Id of the insert that linked this element, unique within `_grid`, or 0
	 * when unlinked. A recycled element gets a new id, so a handle that
	 * captured the old one can tell the element was reissued.
	 */
	public _linkId: number = 0;

	/**
	 * @param element	Initial value. Omitted when constructed by an `ObjectPool`,
	 * 					which hands out blank elements for the data structure to fill.
	 */
	constructor(element?: T) {
		if (element !== undefined) {
			this._value = element;
		}
	}

	/**
	 * Reset every field to its blank state. Called by `ObjectPool` on release
	 * so a recycled element never carries a previous item or its links. Any
	 * new field added to this class must be cleared here.
	 */
	public cleanObj(): void {
		this._value = null;
		this._x = 0;
		this._y = 0;
		this._z = 0;
		this._cellX = 0;
		this._cellY = 0;
		this._cellZ = 0;
		this._slot = -1;
		this._cellNext = null;
		this._cellPrev = null;
		this._next = null;
		this._prev = null;
		this._grid = null;
		this._linkId = 0;
	}

	/**
	 * Get the element's value, or set it when elementValue is provided.
	 *
	 * @remarks
	 * While the element is linked, a new value is only accepted when the
	 * locator places it at exactly the element's position (e.g. replacing an
	 * item with an updated copy that has not moved). Any other value would
	 * file the item under the wrong position, so it is ignored: use the data
	 * structure's `update()` instead, which moves the element when needed.
	 */
	public value(elementValue?: T): T | null {
		if (typeof elementValue === 'undefined') {
			return this._value;
		}

		if (this._grid === null) {
			this._value = elementValue;
			return null;
		}

		const point = this._grid.locator(elementValue);

		if (point && point.x === this._x && point.y === this._y && point.z === this._z) {
			this._value = elementValue;
		}

		return null;
	}

	/** X coordinate the item was filed under. */
	public x(): number {
		return this._x;
	}

	/** Y coordinate the item was filed under. */
	public y(): number {
		return this._y;
	}

	/** Z coordinate the item was filed under. */
	public z(): number {
		return this._z;
	}

	/** Integer x coordinate of the cell holding the item. */
	public cellX(): number {
		return this._cellX;
	}

	/** Integer y coordinate of the cell holding the item. */
	public cellY(): number {
		return this._cellY;
	}

	/** Integer z coordinate of the cell holding the item. */
	public cellZ(): number {
		return this._cellZ;
	}
}
