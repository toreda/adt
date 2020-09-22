import ArmorCollectionSelector from './selector';

export default interface ArmorCollection<T> {
	find(...args: any[]): ArmorCollectionSelector<T>;
	clearElements(): void;
	reset(): void;
	parse(s: string): any;
	stringify(): string | null;
}
