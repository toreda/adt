export function repeat(n: number, f: Function) {
	while (n-- > 0) {
		f(n);
	}
}
