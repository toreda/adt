import {LinkedListElement} from '../../../src/linked/list/element';

describe('LinkedListElement', () => {
	it('starts blank without a value', () => {
		const node = new LinkedListElement<number>();

		expect(node.value()).toBeNull();
		expect(node.prev()).toBeNull();
		expect(node.next()).toBeNull();
	});

	it('takes an initial value', () => {
		expect(new LinkedListElement(42).value()).toBe(42);
	});

	it('implements ObjectPoolInstance', () => {
		expect(typeof new LinkedListElement<number>().cleanObj).toBe('function');
	});

	it('cleanObj resets every field to the blank state', () => {
		const node = new LinkedListElement(1);
		node.prev(new LinkedListElement(0));
		node.next(new LinkedListElement(2));

		node.cleanObj();

		expect(node).toEqual(new LinkedListElement<number>());
		expect(Object.keys(node)).toEqual(Object.keys(new LinkedListElement<number>()));
	});

	it('is usable again after cleanObj', () => {
		const node = new LinkedListElement(1);
		node.cleanObj();
		node.value(7);

		expect(node.value()).toBe(7);
	});
});
