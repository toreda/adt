import {ElementPool} from '../../src/element/pool';
import {ObjectPool} from '../../src/object/pool';
import {type ObjectPoolInstance} from '../../src/object/pool/instance';

class Node implements ObjectPoolInstance {
	public payload: string | null = null;

	cleanObj(): void {
		this.payload = null;
	}
}

const stateOf = (pool: ElementPool<Node>): any => (pool.objectPool as any).state;

describe('ElementPool', () => {
	describe('construction', () => {
		it('pools by default with an empty, growing pool', () => {
			const pool = new ElementPool(Node);

			expect(pool.enabled()).toBe(true);
			expect(pool.objectPool).toBeInstanceOf(ObjectPool);
			expect(stateOf(pool).startSize).toBe(0);
			expect(stateOf(pool).autoIncrease).toBe(true);
			expect(stateOf(pool).maxSize).toBe(Number.MAX_SAFE_INTEGER);
			expect(stateOf(pool).objectCount).toBe(0);
		});

		it('only strict true disables pooling', () => {
			expect(new ElementPool(Node, {disableElementPooling: true}).enabled()).toBe(false);
			expect(new ElementPool(Node, {disableElementPooling: true}).objectPool).toBeNull();
			expect(new ElementPool(Node, {disableElementPooling: false}).enabled()).toBe(true);
			expect(new ElementPool(Node, {disableElementPooling: 'true' as any}).enabled()).toBe(true);
			expect(new ElementPool(Node, {disableElementPooling: 1 as any}).enabled()).toBe(true);
			expect(new ElementPool(Node, null).enabled()).toBe(true);
			expect(new ElementPool(Node, {}).enabled()).toBe(true);
		});

		it('pool options override the defaults entry by entry', () => {
			const pool = new ElementPool(Node, {pool: {startSize: 3, maxSize: 3}});

			expect(stateOf(pool).startSize).toBe(3);
			expect(stateOf(pool).maxSize).toBe(3);
			expect(stateOf(pool).autoIncrease).toBe(true);
			expect(stateOf(pool).objectCount).toBe(3);
		});

		it('null or invalid pool options keep the defaults', () => {
			expect(stateOf(new ElementPool(Node, {pool: null})).startSize).toBe(0);
			expect(stateOf(new ElementPool(Node, {pool: 'nope' as any})).startSize).toBe(0);
		});

		it('pool options are ignored when disabled', () => {
			expect(
				new ElementPool(Node, {disableElementPooling: true, pool: {startSize: 5}}).objectPool
			).toBeNull();
		});
	});

	describe('allocate', () => {
		it('returns a blank element from the pool', () => {
			const pool = new ElementPool(Node);
			const node = pool.allocate();

			expect(node).toBeInstanceOf(Node);
			expect(node.payload).toBeNull();
			expect(pool.size()).toBe(1);
		});

		it('constructs a new element when disabled', () => {
			const pool = new ElementPool(Node, {disableElementPooling: true});

			expect(pool.allocate()).toBeInstanceOf(Node);
			expect(pool.size()).toBe(0);
		});

		it('falls back to construction when the pool is capped', () => {
			const pool = new ElementPool(Node, {pool: {maxSize: 1}});
			const first = pool.allocate();
			const second = pool.allocate();

			expect(first).toBeInstanceOf(Node);
			expect(second).toBeInstanceOf(Node);
			expect(second).not.toBe(first);
			expect(pool.size()).toBe(1);
		});

		it('falls back to construction when allocate returns null', () => {
			const pool = new ElementPool(Node);
			jest.spyOn(pool.objectPool as ObjectPool<Node>, 'allocate').mockReturnValue(null);

			expect(pool.allocate()).toBeInstanceOf(Node);
		});
	});

	describe('release', () => {
		it('blanks and recycles the element', () => {
			const pool = new ElementPool(Node);
			const node = pool.allocate();
			node.payload = 'x';

			pool.release(node);

			expect(node.payload).toBeNull();
			expect(pool.size()).toBe(0);
			expect(pool.allocate()).toBe(node);
		});

		it('is a no-op when disabled', () => {
			const pool = new ElementPool(Node, {disableElementPooling: true});
			const node = pool.allocate();
			node.payload = 'x';

			pool.release(node);

			expect(node.payload).toBe('x');
			expect(pool.allocate()).not.toBe(node);
		});

		it('releaseAll recycles every element', () => {
			const pool = new ElementPool(Node);
			const nodes = [pool.allocate(), pool.allocate(), pool.allocate()];
			nodes.forEach((n, i) => (n.payload = String(i)));

			pool.releaseAll(nodes);

			expect(pool.size()).toBe(0);
			expect(nodes.every((n) => n.payload === null)).toBe(true);

			const again = [pool.allocate(), pool.allocate(), pool.allocate()];
			expect(again.every((n) => nodes.includes(n))).toBe(true);
		});

		it('releaseAll is a no-op when disabled', () => {
			const pool = new ElementPool(Node, {disableElementPooling: true});
			const node = pool.allocate();
			node.payload = 'x';

			pool.releaseAll([node]);

			expect(node.payload).toBe('x');
		});
	});

	describe('options', () => {
		it('mirrors the pooling entries it was built with', () => {
			expect(new ElementPool(Node).options()).toEqual({disableElementPooling: false, pool: null});
			expect(new ElementPool(Node, {disableElementPooling: true}).options()).toEqual({
				disableElementPooling: true,
				pool: null
			});
			expect(new ElementPool(Node, {pool: {maxSize: 4}}).options()).toEqual({
				disableElementPooling: false,
				pool: {maxSize: 4}
			});
		});

		it('rebuilds an equivalent pool', () => {
			const source = new ElementPool(Node, {pool: {startSize: 2, maxSize: 2}});
			const copy = new ElementPool(Node, source.options());

			expect(stateOf(copy).startSize).toBe(2);
			expect(stateOf(copy).maxSize).toBe(2);
		});
	});
});
