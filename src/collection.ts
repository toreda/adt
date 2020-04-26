import {ArmorCollectionSelector} from './selector';

export interface ArmorCollection<T> {
	select(...args: any[]): ArmorCollectionSelector<T>;
	clear(): void;
}
