export interface ADTCollectionQueryRange {
	min?: number;
	max?: number;
}

export interface ADTCollectionQueryProperties {}

export interface ADTCollectionQueryMatch {}

export type ADTCollectionQueryFilter = (value: any) => boolean;

export interface ADTCollectionQuery {
	range?: ADTCollectionQueryRange;
	index?: number;
	limit?: number;
	filters?: ADTCollectionQueryFilter | ADTCollectionQueryFilter[];
}
