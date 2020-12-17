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
