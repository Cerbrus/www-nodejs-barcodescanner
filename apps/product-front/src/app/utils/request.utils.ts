export interface ISortingModel<T> {
    id?: string;
    property: keyof T;
    direction: TSortDirection;
    order: number;
}

export interface IPaginatedRequest<T extends TRecord<T>> {
    pagination: { start: number; step: number };
    sort: Array<ISortingModel<T>>;
}

export type TSortDirection = 'asc' | 'desc';
type TRecord<T> = Record<keyof T, unknown>;

export class RequestUtils {
    public static buildSortParameters<T extends TRecord<T>>(
        sort: Array<ISortingModel<T>> = [],
    ): {
        sort: Array<keyof T>;
        dir: Array<TSortDirection>;
    } {
        return {
            sort: sort.map((s) => s.property),
            dir: sort.map((s) => s.direction),
        };
    }

    public static MapKeys<TFrom extends object, TTo extends object>(
        keyMap: Record<keyof TFrom, keyof TTo>,
        sort: Array<ISortingModel<TFrom>>,
    ): Array<ISortingModel<TTo>> {
        return sort.map((s) => ({ ...s, property: keyMap[s.property] }));
    }
}
