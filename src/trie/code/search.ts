/**
 * Binary search for code in sorted codes, the child code units of a
 * `TrieElement`. Allocates nothing.
 * @returns		Index of code when present, otherwise `-(insertion index) - 1`,
 * 				so the result is negative exactly when code is missing.
 */
export function trieCodeSearch(codes: number[], code: number): number {
	let low = 0;
	let high = codes.length - 1;

	while (low <= high) {
		const mid = (low + high) >>> 1;
		const curr = codes[mid];

		if (curr < code) {
			low = mid + 1;
		} else if (curr > code) {
			high = mid - 1;
		} else {
			return mid;
		}
	}

	return -low - 1;
}
