import { ADTCollectionQuery, ADTCollectionQueryFilter } from './query';

export interface ADTCollectionSelectorStateRange {
	min: number | null;
	max: number | null;
}

export class ADTCollectionSelectorState {
	public readonly range: ADTCollectionSelectorStateRange;
	public readonly index: number | null;
	public readonly filters: ADTCollectionQueryFilter[];
	public readonly limit: number | null;

	constructor(query?: ADTCollectionQuery) {
		this.index = null;
		this.range = {
			min: null,
			max: null
		};

		this.filters = this.createFilters(query);
		this.index = this.createIndex(query);
		this.limit = this.createLimit(query);
	}

	public createLimit(query?: ADTCollectionQuery): number|null {
		if (!query || typeof query.limit !== 'number') {
			return null;
		}

		return query.limit;
	}

	public createRange(query?: ADTCollectionQuery): any {
		const range: ADTCollectionSelectorStateRange = {
			min: null,
			max: null
		};

		if (!query || !query.range) {
			return range;
		}

		if (typeof query.range.min === 'number') {
			range.min = query.range.min;
		}

		if (typeof query.range.max === 'number') {
			range.max = query.range.max;
		}

		return range;
	}

	public createIndex(query?: ADTCollectionQuery): number | null {
		if (!query || typeof query.index !== 'number') {
			return null;
		}

		return query.index;
	}

	public createFilters(query?: ADTCollectionQuery): ADTCollectionQueryFilter[] {
		if (!query) {
			return [];
		}

		if (!query.filters) {
			return [];
		}

		if (!Array.isArray(query.filters)) {
			return [query.filters];
		}

		return query.filters;
	}
}