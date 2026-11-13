import { Barcode, CatalogItem, ListEntry, Section } from '../models';

export interface Snapshot {
    savedAt: string;
    sections: Array<Section>;
    items: Array<CatalogItem>;
    entries: Array<ListEntry>;
    inbox: Array<Barcode>;
}

const SNAPSHOT_KEY = 'snapshot';

export function loadSnapshot(): Snapshot | undefined {
    try {
        const stored = localStorage.getItem(SNAPSHOT_KEY);
        const snapshot = stored ? (JSON.parse(stored) as Snapshot) : undefined;

        return snapshot?.savedAt && Array.isArray(snapshot.entries) ? snapshot : undefined;
    } catch {
        return undefined;
    }
}

export function saveSnapshot(snapshot: Snapshot): void {
    try {
        localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
    } catch {
        clearSnapshot();
    }
}

export function clearSnapshot(): void {
    try {
        localStorage.removeItem(SNAPSHOT_KEY);
    } catch {
        return;
    }
}
