
export interface ArmorCollectionQueryRange {
	min?: number;
	max?: number;
}

export interface ArmorCollectionQueryProperties {}

export interface ArmorCollectionQueryMatch {}

export type ArmorCollectionQueryFilter = (value: any) => boolean;

export interface ArmorCollectionQuery {
	range?: ArmorCollectionQueryRange;
	index?: number;
	limit?: number;
	filters?: ArmorCollectionQueryFilter | ArmorCollectionQueryFilter[];
}
