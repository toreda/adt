import {CircularQueue} from '../../src/circular/queue';
import {CircularQueueIterator} from '../../src/circular/queue/iterator';

/** Raw ring buffer, for checking where items physically sit. */
const bufferOf = (q: CircularQueue<any>): unknown[] => (q as any)._elements;

/** Queue of maxSize 5 whose items wrap around the end of the ring buffer. */
const wrapped = (): CircularQueue<string> => {
	const q = new CircularQueue<string>(['a', 'b', 'c', 'd', 'e'], {maxSize: 5});
	q.pop();
	q.pop();
	q.push('f');
	q.push('g');
	// Physical layout is now [f, g, c, d, e] with the front in slot 2.
	return q;
};

describe('CircularQueue', () => {
	describe('constructor', () => {
		it('defaults', () => {
			const q = new CircularQueue<number>();

			expect(q).toBeInstanceOf(CircularQueue);
			expect(q.size()).toBe(0);
			expect(q.maxSize).toBe(25);
			expect(q.overwrite).toBe(false);
		});

		it('with items pushed front to rear', () => {
			const q = new CircularQueue<number>([1, 2, 3]);

			expect(q.size()).toBe(3);
			expect(q.front()).toBe(1);
			expect(q.rear()).toBe(3);
		});

		it('does not keep a reference to the provided array', () => {
			const items = [1, 2, 3];
			const q = new CircularQueue<number>(items);
			items.push(4);

			expect(q.size()).toBe(3);
		});

		it('with options', () => {
			const q = new CircularQueue<number>([], {maxSize: 7, overwrite: true});

			expect(q.maxSize).toBe(7);
			expect(q.overwrite).toBe(true);
		});

		it('drops items beyond maxSize, or keeps the last ones with overwrite', () => {
			expect(new CircularQueue<number>([1, 2, 3, 4], {maxSize: 3}).values()).toEqual([1, 2, 3]);
			expect(new CircularQueue<number>([1, 2, 3, 4], {maxSize: 3, overwrite: true}).values()).toEqual([
				2, 3, 4
			]);
		});

		it('invalid options fall back to defaults instead of throwing', () => {
			for (const maxSize of [0, -1, 1.5, NaN, Infinity, '7', null]) {
				expect(new CircularQueue<number>([], {maxSize: maxSize as any}).maxSize).toBe(25);
			}
			for (const overwrite of [0, 1, 'true', null, {}]) {
				expect(new CircularQueue<number>([], {overwrite: overwrite as any}).overwrite).toBe(false);
			}
			expect(new CircularQueue<number>([1], null).size()).toBe(1);
			expect(new CircularQueue<number>([1], 'nope' as any).maxSize).toBe(25);
		});

		it('ignores invalid data instead of throwing', () => {
			expect(new CircularQueue('adsf' as any).size()).toBe(0);
			expect(new CircularQueue(null).size()).toBe(0);
			expect(new CircularQueue({elements: [4]} as any).size()).toBe(0);
			expect(new CircularQueue(new Uint8Array([1, 2, 3]) as any).size()).toBe(0);
		});

		it('has no byte methods; those belong to ByteCircularQueue', () => {
			const q = new CircularQueue<number>([1]) as any;

			expect(q.toBytes).toBeUndefined();
			expect(q.toByteEnvelope).toBeUndefined();
			expect(q.toBinary).toBeUndefined();
		});
	});

	describe('push / pop', () => {
		it('moves front and rear', () => {
			const q = new CircularQueue<number>([], {maxSize: 7});

			expect(q.front()).toBeNull();
			expect(q.rear()).toBeNull();

			[99, 13, 24, 35].forEach((v) => {
				expect(q.push(v)).toBe(true);
				expect(q.rear()).toBe(v);
				expect(q.front()).toBe(99);
			});

			expect(q.pop()).toBe(99);
			expect(q.front()).toBe(13);
			expect(q.peek()).toBe(13);
			expect(q.size()).toBe(3);
		});

		it('pop returns null when empty', () => {
			expect(new CircularQueue<number>().pop()).toBeNull();
		});

		it('blocks push when full without overwrite', () => {
			const q = new CircularQueue<number>([1, 2, 3], {maxSize: 3});

			expect(q.isFull()).toBe(true);
			expect(q.push(4)).toBe(false);
			expect(q.values()).toEqual([1, 2, 3]);
		});

		it('pushArray adds items until full, then reports failure', () => {
			const q = new CircularQueue<number>([], {maxSize: 3});

			expect(q.pushArray([1, 2, 3, 4, 5])).toBe(false);
			expect(q.values()).toEqual([1, 2, 3]);
		});

		it('push takes exactly one item', () => {
			const q = new CircularQueue<number>([], {maxSize: 5});

			expect(q.push.length).toBe(1);
			expect((q.push as any)(1, 2, 3)).toBe(true);
			expect(q.values()).toEqual([1]);
		});

		it('push and pop never replace the ring buffer', () => {
			const q = new CircularQueue<number>([], {maxSize: 4, overwrite: true});
			const buffer = bufferOf(q);

			for (let i = 0; i < 50; i++) {
				q.push(i);
				if (i % 3 === 0) {
					q.pop();
				}
				q.insertFront(-i);
			}

			expect(bufferOf(q)).toBe(buffer);
			expect(buffer.length).toBe(4);
		});

		it('overwrites the front item when full with overwrite', () => {
			const q = new CircularQueue<number>([10, 20, 30, 40], {maxSize: 4, overwrite: true});

			expect(q.push(50)).toBe(true);
			expect(q.size()).toBe(4);
			expect(q.front()).toBe(20);
			expect(q.rear()).toBe(50);
			expect(q.values()).toEqual([20, 30, 40, 50]);
		});

		it('pushArray handles arrays of any length', () => {
			const q = new CircularQueue<number>([], {maxSize: 200000});
			const items = Array.from({length: 150000}, (_, i) => i);

			expect(q.pushArray(items)).toBe(true);
			expect(q.size()).toBe(150000);
			expect(q.rear()).toBe(149999);
			expect(q.pushArray(null)).toBe(false);
			expect(q.pushArray('abc' as any)).toBe(false);
		});

		it('pop releases the reference to the removed item', () => {
			const item = {id: 1};
			const q = new CircularQueue<object>([item]);
			q.pop();

			expect(bufferOf(q)).not.toContain(item);
		});

		it('keeps order across many wraps', () => {
			const q = new CircularQueue<number>([], {maxSize: 3});
			const expected: number[] = [];

			for (let i = 0; i < 20; i++) {
				q.push(i);
				expected.push(i);
				if (i % 2 === 1) {
					expect(q.pop()).toBe(expected.shift());
				}
				if (q.isFull()) {
					expect(q.pop()).toBe(expected.shift());
				}
				expect(q.values()).toEqual(expected);
			}
		});
	});

	describe('insertFront', () => {
		it('inserts an item ahead of the current front', () => {
			const q = new CircularQueue<number>([1, 2, 3], {maxSize: 7});

			expect(q.insertFront(0)).toBe(true);
			expect(q.values()).toEqual([0, 1, 2, 3]);
		});

		it('takes exactly one item', () => {
			const q = new CircularQueue<number>([], {maxSize: 5});

			expect(q.insertFront.length).toBe(1);
			expect((q.insertFront as any)(1, 2, 3)).toBe(true);
			expect(q.values()).toEqual([1]);
		});

		it('insertFrontArray inserts one at a time, last item in front', () => {
			const q = new CircularQueue<number>([1, 2, 3], {maxSize: 7});

			expect(q.insertFrontArray([0, -1, -2])).toBe(true);
			expect(q.values()).toEqual([-2, -1, 0, 1, 2, 3]);
			expect(q.insertFrontArray([])).toBe(true);
			expect(q.size()).toBe(6);
		});

		it('insertFrontArray stops when full without overwrite', () => {
			const q = new CircularQueue<number>([1], {maxSize: 3});

			expect(q.insertFrontArray([2, 3, 4, 5])).toBe(false);
			expect(q.values()).toEqual([3, 2, 1]);
		});

		it('insertFrontArray overwrites the rear with overwrite', () => {
			const q = new CircularQueue<number>([1, 2], {maxSize: 3, overwrite: true});

			expect(q.insertFrontArray([3, 4, 5])).toBe(true);
			expect(q.values()).toEqual([5, 4, 3]);
		});

		it('insertFrontArray rejects non-arrays', () => {
			const q = new CircularQueue<number>([1]);

			expect(q.insertFrontArray(null)).toBe(false);
			expect(q.insertFrontArray(undefined)).toBe(false);
			expect(q.insertFrontArray('ab' as any)).toBe(false);
			expect(q.values()).toEqual([1]);
		});

		it('inserts into an empty queue', () => {
			const q = new CircularQueue<string>();
			q.insertFront('a');
			q.insertFront('b');

			expect(q.front()).toBe('b');
			expect(q.rear()).toBe('a');
			expect([...q]).toEqual(['b', 'a']);
		});

		it('overwrites the rear item when full with overwrite', () => {
			const q = new CircularQueue<number>([1, 2, 3], {maxSize: 3, overwrite: true});

			expect(q.insertFront(0)).toBe(true);
			expect(q.size()).toBe(3);
			expect(q.values()).toEqual([0, 1, 2]);
		});

		it('returns false when full without overwrite', () => {
			const q = new CircularQueue<number>([1, 2, 3], {maxSize: 3});

			expect(q.insertFront(0)).toBe(false);
			expect(q.values()).toEqual([1, 2, 3]);
		});
	});

	describe('getIndex', () => {
		it('counts from the front, and from the rear when negative', () => {
			const q = wrapped();

			expect([0, 1, 2, 3, 4].map((n) => q.getIndex(n))).toEqual(['c', 'd', 'e', 'f', 'g']);
			expect([-1, -2, -5].map((n) => q.getIndex(n))).toEqual(['g', 'f', 'c']);
		});

		it('returns null outside the queue or for non-integers', () => {
			const q = new CircularQueue<number>([1, 2, 3], {maxSize: 10});

			expect(q.getIndex(3)).toBeNull();
			expect(q.getIndex(-4)).toBeNull();
			expect(q.getIndex(1.6)).toBeNull();
			expect(q.getIndex(NaN)).toBeNull();
			expect(new CircularQueue<number>().getIndex(0)).toBeNull();
		});
	});

	describe('forEach / values / iteration', () => {
		it('visits front to rear with logical positions and the queue', () => {
			const q = wrapped();
			const seen: [string, number][] = [];

			expect(
				q.forEach((item, index, queue) => {
					expect(queue).toBe(q);
					seen.push([item, index]);
				})
			).toBe(q);
			expect(seen).toEqual([
				['c', 0],
				['d', 1],
				['e', 2],
				['f', 3],
				['g', 4]
			]);
		});

		it('passes thisArg as given', () => {
			const q = new CircularQueue<number>([1]);
			const context = {};
			const received: unknown[] = [];
			q.forEach(function (this: unknown) {
				received.push(this);
			}, context);

			expect(received[received.length - 1]).toBe(context);
		});

		it('values and iteration run front to rear', () => {
			const q = wrapped();

			expect(q.values()).toEqual(['c', 'd', 'e', 'f', 'g']);
			expect([...q]).toEqual(['c', 'd', 'e', 'f', 'g']);
			expect([...new CircularQueue<number>()]).toEqual([]);
		});

		it('iterator reports done with a null value when exhausted', () => {
			const iter = new CircularQueueIterator(new CircularQueue<number>([10]));

			expect(iter.next()).toEqual({value: 10, done: false});
			expect(iter.next()).toEqual({value: null, done: true});
			expect(iter.next()).toEqual({value: null, done: true});
		});

		it('iterator reuses one result object', () => {
			const iter = new CircularQueueIterator(wrapped());
			const first = iter.next();

			expect(first.value).toBe('c');
			const second = iter.next();
			expect(second).toBe(first);
			expect(second.value).toBe('d');
			for (let i = 0; i < 4; i++) {
				expect(iter.next()).toBe(first);
			}
			expect(first.done).toBe(true);
		});
	});

	describe('filter', () => {
		it('returns a new queue of matching items with the same options', () => {
			const q = new CircularQueue<number | string>([1, 'a', 2, 'b', 3], {maxSize: 9, overwrite: true});
			const numbers = q.filter((item) => typeof item === 'number');

			expect(numbers).not.toBe(q);
			expect(numbers.values()).toEqual([1, 2, 3]);
			expect(numbers.maxSize).toBe(9);
			expect(numbers.overwrite).toBe(true);
			expect(q.size()).toBe(5);
		});

		it('passes logical positions and thisArg', () => {
			const q = wrapped();
			const context = {skip: 'e'};
			const result = q.filter(function (this: typeof context, item, index) {
				return item !== this.skip && index < 4;
			}, context);

			expect(result.values()).toEqual(['c', 'd', 'f']);
		});
	});

	describe('query', () => {
		it('matches front to rear and respects the limit', () => {
			const q = new CircularQueue<number>([10, 20, 30, 40, 50]);

			expect(q.query((v) => v > 15).map((r) => r.element)).toEqual([20, 30, 40, 50]);
			expect(q.query([(v) => v > 15, (v) => v < 45]).map((r) => r.element)).toEqual([20, 30, 40]);
			expect(q.query(() => true, {limit: 2}).map((r) => r.element)).toEqual([10, 20]);
			expect(q.query([])).toEqual([]);
		});

		it('stops calling filters once the limit is reached', () => {
			const q = new CircularQueue<number>([10, 20, 30, 40, 50]);
			let calls = 0;
			const results = q.query(
				() => {
					calls++;
					return true;
				},
				{limit: 2}
			);

			expect(results.length).toBe(2);
			expect(calls).toBe(2);
		});

		it('stops at the first failing filter in an array', () => {
			const q = new CircularQueue<number>([1, 2, 3]);
			let secondCalls = 0;
			const results = q.query([
				(v) => v > 1,
				() => {
					secondCalls++;
					return true;
				}
			]);

			expect(results.map((r) => r.element)).toEqual([2, 3]);
			expect(secondCalls).toBe(2);
		});

		it('ignores an invalid limit', () => {
			const q = new CircularQueue<number>([1, 2, 3]);

			for (const limit of [0, -1, NaN, 'a', null]) {
				expect(q.query(() => true, {limit: limit as any}).length).toBe(3);
			}
			expect(q.query(() => true, {limit: 1.6}).length).toBe(2);
		});

		it('results share one key function', () => {
			const q = new CircularQueue<number>([1, 2]);
			const [a, b] = q.query(() => true);

			expect(a.key).toBe(b.key);
			expect(a.key()).toBeNull();
		});

		it('index is the current position from the front', () => {
			const q = new CircularQueue<number>([10, 20, 30, 40, 50]);
			const [match] = q.query((v) => v === 30);

			expect(match.key()).toBeNull();
			expect(match.index()).toBe(2);
			q.pop();
			expect(match.index()).toBe(1);
		});

		it('delete removes the item once and keeps order', () => {
			const q = new CircularQueue<number>([10, 20, 30, 40, 50]);
			const [match] = q.query((v) => v === 30);

			expect(match.delete()).toBe(30);
			expect(match.delete()).toBeNull();
			expect(match.index()).toBeNull();
			expect(q.values()).toEqual([10, 20, 40, 50]);
		});

		it('preserves order when deleting from a wrapped queue', () => {
			const q = wrapped();

			expect(q.query((v) => v === 'd')[0].delete()).toBe('d');
			expect(q.values()).toEqual(['c', 'e', 'f', 'g']);
			expect(q.push('h')).toBe(true);
			expect(q.values()).toEqual(['c', 'e', 'f', 'g', 'h']);
		});

		it('deletes the rear item of a wrapped queue', () => {
			const q = wrapped();

			expect(q.query((v) => v === 'g')[0].delete()).toBe('g');
			expect(q.values()).toEqual(['c', 'd', 'e', 'f']);
			expect(q.rear()).toBe('f');
		});
	});

	describe('stringify', () => {
		it('serializes items front to rear', () => {
			expect(wrapped().stringify()).toBe('{"type":"CircularQueue","elements":["c","d","e","f","g"]}');
		});

		it('returns null for items that cannot be serialized', () => {
			expect(new CircularQueue<bigint>([BigInt(1)]).stringify()).toBeNull();
		});
	});

	describe('clearElements / reset', () => {
		it('remove every item and keep options', () => {
			const q = new CircularQueue<number>([1, 2, 3], {maxSize: 3, overwrite: true});

			expect(q.clearElements()).toBe(q);
			expect(q.size()).toBe(0);
			expect(q.front()).toBeNull();
			q.push(4);
			expect(q.values()).toEqual([4]);

			expect(q.reset()).toBe(q);
			expect(q.isEmpty()).toBe(true);
			expect(q.maxSize).toBe(3);
			expect(q.overwrite).toBe(true);
		});

		it('reuse the ring buffer and drop item references', () => {
			const a = {id: 'a'};
			const b = {id: 'b'};
			const q = new CircularQueue<object>([a, b], {maxSize: 4});
			const buffer = bufferOf(q);

			q.clearElements();
			expect(bufferOf(q)).toBe(buffer);
			expect(buffer.length).toBe(4);
			expect(buffer).not.toContain(a);
			expect(buffer).not.toContain(b);

			q.push(b);
			q.reset();
			expect(bufferOf(q)).toBe(buffer);
			expect(buffer).not.toContain(b);
		});

		it('clears a wrapped queue', () => {
			const q = wrapped();
			q.clearElements();

			expect(bufferOf(q).every((slot) => slot === undefined)).toBe(true);
			expect(q.pushArray(['x', 'y'])).toBe(true);
			expect(q.values()).toEqual(['x', 'y']);
		});
	});

	describe('ring buffer', () => {
		it('preallocates maxSize packed slots at construction', () => {
			const buffer = bufferOf(new CircularQueue<number>([], {maxSize: 6}));

			expect(buffer.length).toBe(6);
			for (let i = 0; i < 6; i++) {
				expect(i in buffer).toBe(true);
				expect(buffer[i]).toBeUndefined();
			}
		});

		it('insertFront on an empty queue writes the last slot without growing the buffer', () => {
			const q = new CircularQueue<number>([], {maxSize: 5});
			q.insertFront(1);

			expect(bufferOf(q)).toEqual([undefined, undefined, undefined, undefined, 1]);
			expect(q.front()).toBe(1);
			expect(q.rear()).toBe(1);
		});

		it('wraps slots correctly with maxSize 1', () => {
			const q = new CircularQueue<number>([], {maxSize: 1, overwrite: true});

			expect(q.push(1)).toBe(true);
			expect(q.push(2)).toBe(true);
			expect(q.insertFront(3)).toBe(true);
			expect(q.values()).toEqual([3]);
			expect(q.getIndex(-1)).toBe(3);
			expect(q.pop()).toBe(3);
			expect(q.pop()).toBeNull();
		});

		it('keeps every position correct across wraps in both directions', () => {
			const q = new CircularQueue<number>([], {maxSize: 5});
			const model: number[] = [];

			for (let i = 0; i < 200; i++) {
				const op = (i * 7) % 6;
				if (op < 3 && !q.isFull()) {
					q.push(i);
					model.push(i);
				} else if (op === 3 && !q.isFull()) {
					q.insertFront(i);
					model.unshift(i);
				} else {
					expect(q.pop()).toBe(model.length ? model.shift() : null);
				}

				expect(q.values()).toEqual(model);
				expect(q.front()).toBe(model.length ? model[0] : null);
				expect(q.rear()).toBe(model.length ? model[model.length - 1] : null);
				for (let p = -model.length; p < model.length; p++) {
					expect(q.getIndex(p)).toBe(model[p < 0 ? p + model.length : p]);
				}
			}
		});
	});
});
