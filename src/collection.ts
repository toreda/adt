import ADTCollectionSelector from './selector';

export default interface ArmorCollection<T> {
	find(...args: any[]): ArmorCollectionSelector<T>;
	clearElements(): void;
	reset(): void;
	parse(s: string): any | Array<string> | null;
	stringify(): string | null;
}
