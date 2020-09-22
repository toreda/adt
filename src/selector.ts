import ADTCollection from './collection';
import { ADTCollectionQuery } from './query';

export default class ADTSelector<T> {
	public readonly collection: ArmorCollection<T>;

	constructor(collection: ADTCollection<T>, query?: ADTCollectionQuery) {
		this.collection = collection;
	}

}
