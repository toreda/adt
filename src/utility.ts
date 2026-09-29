export function isNumber(data: unknown): data is number {
	if (typeof data !== 'number') {
		return false;
	}

	if (isNaN(data)) {
		return false;
	}

	return true;
}

export function isInteger(data: unknown): data is number {
	if (typeof data !== 'number') {
		return false;
	}

	if (data % 1 !== 0) {
		return false;
	}

	return true;
}

/**
 * Handling for an undefined item reaching an insert path, shared by every
 * data structure. True when item is undefined and `allowUndefinedItem` is on,
 * telling the caller to skip the insert as a no-op. Throws when item is
 * undefined and the option is strictly `false`. False when item is defined:
 * the insert proceeds.
 */
export function undefinedItemSkip(item: unknown, allow: boolean, owner: string): boolean {
	if (item !== undefined) {
		return false;
	}

	if (!allow) {
		throw new Error(`${owner} received an undefined item and allowUndefinedItem is false`);
	}

	return true;
}
