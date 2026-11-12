// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function BaseMapper<S, T>(mapFn: (source: S) => T) {
    return class {
        public static map(source: S): T;
        public static map(source: Array<S>): Array<T>;
        public static map(source: undefined | null): undefined;
        public static map(source?: S | Array<S> | undefined | null): T | Array<T> | undefined {
            if (source === undefined || source == null) return undefined;

            return Array.isArray(source) ? source.map((e) => mapFn(e)) : mapFn(source);
        }
    };
}
