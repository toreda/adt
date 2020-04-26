import { ArmorCollectionQuery, ArmorCollectionQueryFilter } from './query';
export interface ArmorCollectionSelectorStateRange {
	min: number | null;
	max: number | null;
}

export class ArmorCollectionSelectorState {
	public readonly range: ArmorCollectionSelectorStateRange;
	public readonly index: number | null;
	public readonly filters: ArmorCollectionQueryFilter[];
	public readonly limit: number | null;

	constructor(query?: ArmorCollectionQuery) {
		this.index = null;
		this.range = {
			min: null,
			max: null
		};

		this.filters = this.createFilters(query);
		this.index = this.createIndex(query);
		this.limit = this.createLimit(query);
	}

	public createLimit(query?: ArmorCollectionQuery): number|null {
		if (!query || typeof query.limit !== 'number') {
			return null;
		}

		return query.limit;
	}

	public createRange(query?: ArmorCollectionQuery): any {
		const range: ArmorCollectionSelectorStateRange = {
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

	public createIndex(query?: ArmorCollectionQuery): number | null {
		if (!query || typeof query.index !== 'number') {
			return null;
		}

		return query.index;
	}

	public createFilters(query?: ArmorCollectionQuery): ArmorCollectionQueryFilter[] {
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