import { Signal, WritableSignal, computed, signal } from '@angular/core';
import { Observable, Subject, of } from 'rxjs';

import { Barcode, CatalogItem, ListEntry, Section } from '../app/models';

export const SECTIONS: Array<Section> = [
    { id: 'brood-gebak', name: 'Brood', sortOrder: 1, emoji: '🍞' },
    { id: 'zuivel', name: 'Zuivel', sortOrder: 2, emoji: '🥛' },
    { id: 'dranken', name: 'Dranken', sortOrder: 3, emoji: '🥤' }
];

export function item(id: number, name: string, sectionId = 'zuivel'): CatalogItem {
    return { id, name, sectionId, custom: false };
}

export function entry(catalogItem: CatalogItem, state: ListEntry['state'], quantity = 1, note = ''): ListEntry {
    return { catalogItemId: catalogItem.id, catalogItem, state, quantity: state === 'recent' ? 0 : quantity, note, updatedAt: '2026-11-13T10:00:00.000Z' };
}

export interface FakeStore {
    sections: WritableSignal<Array<Section>>;
    items: WritableSignal<Array<CatalogItem>>;
    entries: WritableSignal<Array<ListEntry>>;
    inbox: WritableSignal<Array<Barcode>>;
    loaded: WritableSignal<boolean>;
    failed: WritableSignal<boolean>;
    settled: WritableSignal<boolean>;
    online: WritableSignal<boolean>;
    updatedAt: WritableSignal<string | undefined>;
    pending: WritableSignal<Array<{ catalogItemId: number }>>;
    pendingIds: Signal<Set<number>>;
    toBuy: Signal<Array<ListEntry>>;
    recent: Signal<Array<ListEntry>>;
    toBuyGroups: Signal<Array<{ section: Section; rows: Array<ListEntry> }>>;
    itemGroups: Signal<Array<{ section: Section; rows: Array<CatalogItem> }>>;
    itemById: (id: number) => CatalogItem | undefined;
    changeEntry: ReturnType<typeof vi.fn>;
    removeEntry: ReturnType<typeof vi.fn>;
    mapBarcode: ReturnType<typeof vi.fn>;
    createItem: ReturnType<typeof vi.fn>;
    refreshAll: ReturnType<typeof vi.fn>;
    refreshListAndInbox: ReturnType<typeof vi.fn>;
    forgetLocalData: ReturnType<typeof vi.fn>;
}

export function fakeStore(items: Array<CatalogItem> = [], entries: Array<ListEntry> = []): FakeStore {
    const sections = signal(SECTIONS);
    const catalog = signal(items);
    const list = signal(entries);
    const pending = signal<Array<{ catalogItemId: number }>>([]);
    const toBuy = computed(() => list().filter((row) => row.state === 'to_buy'));
    const group = <T>(rows: Array<T>, sectionOf: (row: T) => string): Array<{ section: Section; rows: Array<T> }> =>
        sections()
            .map((section) => ({ section, rows: rows.filter((row) => sectionOf(row) === section.id) }))
            .filter((grouped) => grouped.rows.length);

    return {
        sections,
        items: catalog,
        entries: list,
        inbox: signal<Array<Barcode>>([]),
        loaded: signal(true),
        failed: signal(false),
        settled: signal(true),
        online: signal(true),
        updatedAt: signal<string | undefined>(undefined),
        pending,
        pendingIds: computed(() => new Set(pending().map((change) => change.catalogItemId))),
        toBuy,
        recent: computed(() => list().filter((row) => row.state === 'recent')),
        toBuyGroups: computed(() => group(toBuy(), (row) => row.catalogItem.sectionId)),
        itemGroups: computed(() => group(catalog(), (row) => row.sectionId)),
        itemById: (id: number) => catalog().find((row) => row.id === id),
        changeEntry: vi.fn(() => of(undefined)),
        removeEntry: vi.fn(() => of(undefined)),
        mapBarcode: vi.fn(() => of(undefined)),
        createItem: vi.fn(),
        refreshAll: vi.fn(() => of(undefined)),
        refreshListAndInbox: vi.fn(() => of(undefined)),
        forgetLocalData: vi.fn()
    };
}

export interface FakeEvents {
    connected: WritableSignal<boolean>;
    resumed: Subject<void>;
    emit: (type: string, data: unknown) => void;
    on: <T>(...types: Array<string>) => Observable<T>;
    stop: ReturnType<typeof vi.fn>;
}

export function fakeEvents(): FakeEvents {
    const stream = new Subject<{ type: string; data: unknown }>();

    return {
        connected: signal(true),
        resumed: new Subject<void>(),
        emit: (type: string, data: unknown) => stream.next({ type, data }),
        on: <T>(...types: Array<string>) =>
            new Observable<T>((subscriber) => {
                const subscription = stream.subscribe((event) => {
                    if (types.includes(event.type)) {
                        subscriber.next(event.data as T);
                    }
                });

                return () => subscription.unsubscribe();
            }),
        stop: vi.fn()
    };
}

export function texts(root: Element, selector: string): Array<string> {
    return Array.from(root.querySelectorAll(selector), (element) => (element.textContent ?? '').replace(/\s+/g, ' ').trim());
}

export function click(root: Element, selector: string, index = 0): void {
    (root.querySelectorAll(selector)[index] as HTMLElement).click();
}

export function type(root: Element, selector: string, text: string): void {
    const field = root.querySelector(selector) as HTMLInputElement;
    field.value = text;
    field.dispatchEvent(new Event('input'));
}
