import ADTCollection from './collection';
import { ADTCollectionQuery } from './query';

export default class ADTCollectionSelector<T> {
	public readonly collection: ADTCollection<T>;

	constructor(collection: ADTCollection<T>, query?: ADTCollectionQuery) {
		this.collection = collection;
	}

}
