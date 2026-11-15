export function withNote<T extends string | undefined>(name: T, note?: string): T | string {
    return name && note ? `${name} (${note})` : name;
}
