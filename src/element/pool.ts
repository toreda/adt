import {type ADTOptions} from '../adt/options';
import {ObjectPool} from '../object/pool';
import {type ObjectPoolConstructor} from '../object/pool/constructor';
import {type ObjectPoolInstance} from '../object/pool/instance';
import {type ObjectPoolOptions} from '../object/pool/options';

/**
 * Element wrapper pooling shared by every node-based ADT. Wraps an optional
 * `ObjectPool` of the ADT's own element class behind one gate: when pooling is
 * disabled the pool is never created and every call falls through to plain
 * allocation. ADTs hold one of these per element type; array-backed ADTs
 * hold none.
 *
 * @category Base
 */
export class ElementPool<ElementT extends ObjectPoolInstance> {
	/** Pool of blank elements, or null when pooling is disabled. */
	public readonly objectPool: ObjectPool<ElementT> | null;
	private readonly elementClass: ObjectPoolConstructor<ElementT>;
	/** Caller supplied pool config, kept so derived ADTs can be built alike. */
	private readonly poolOptions: ObjectPoolOptions | null;

	/**
	 * @param elementClass	Element wrapper class. Constructed with no arguments,
	 * 						so it must produce a blank element that way.
	 * @param options		ADT options. Pooling is on unless
	 * 						`disableElementPooling` is strictly `true`. `pool`
	 * 						entries override the defaults, which start the pool
	 * 						empty and let it grow with demand.
	 */
	constructor(elementClass: ObjectPoolConstructor<ElementT>, options?: ADTOptions | null) {
		this.elementClass = elementClass;
		this.poolOptions = typeof options?.pool === 'object' ? options.pool : null;
		this.objectPool = options?.disableElementPooling === true ? null : this.createPool();
	}

	private createPool(): ObjectPool<ElementT> {
		const overrides = this.poolOptions !== null ? this.poolOptions : {};

		return new ObjectPool<ElementT>(this.elementClass, {
			startSize: 0,
			autoIncrease: true,
			maxSize: Number.MAX_SAFE_INTEGER,
			...overrides
		});
	}

	public enabled(): boolean {
		return this.objectPool !== null;
	}

	/**
	 * A blank element: recycled from the pool when one is available, otherwise
	 * newly constructed. Falling back keeps the ADT working even if the pool
	 * is capped or disabled.
	 */
	public allocate(): ElementT {
		const element = this.objectPool !== null ? this.objectPool.allocate() : null;

		if (element === null) {
			return new this.elementClass();
		}

		return element;
	}

	/**
	 * Return an element to the pool, which blanks it via `cleanObj()`. No-op
	 * when pooling is disabled. The element must already be unlinked from the
	 * ADT and must not be used afterwards.
	 */
	public release(element: ElementT): void {
		if (this.objectPool !== null) {
			this.objectPool.release(element);
		}
	}

	/**
	 * Release many elements at once. No-op when pooling is disabled.
	 */
	public releaseAll(elements: ElementT[]): void {
		if (this.objectPool !== null) {
			this.objectPool.releaseMultiple(elements);
		}
	}

	/**
	 * Number of pooled elements currently handed out. Zero when disabled.
	 */
	public size(): number {
		return this.objectPool !== null ? this.objectPool.size() : 0;
	}

	/**
	 * The pooling entries of `ADTOptions` this pool was built with, for
	 * building derived ADTs that behave the same way.
	 */
	public options(): ADTOptions {
		return {
			disableElementPooling: this.objectPool === null,
			pool: this.poolOptions
		};
	}
}
