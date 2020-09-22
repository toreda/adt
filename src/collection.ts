import ADTCollectionSelector from './selector';

export default interface ADTCollection<T> {
	select(...args: any[]): ADTCollectionSelector<T>;
	clearElements(): void;
	reset(): void;
	parse(s: string): any;
	stringify(): string | null;
}
