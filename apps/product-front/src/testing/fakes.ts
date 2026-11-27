import { Signal, WritableSignal, computed, signal } from '@angular/core';
import { Observable, Subject, of } from 'rxjs';

import { RecipeContent, RemarkTarget } from '@barcodescanner/shared';

import { Barcode, CatalogItem, ListEntry, Recipe, RecipeOffer, Section } from '../app/models';

export const SECTIONS: Array<Section> = [
    { id: 'brood-gebak', name: 'Brood', sortOrder: 1, emoji: '🍞' },
    { id: 'zuivel', name: 'Zuivel', sortOrder: 2, emoji: '🥛' },
    { id: 'dranken', name: 'Dranken', sortOrder: 3, emoji: '🥤' }
];

export function item(id: number, name: string, sectionId = 'zuivel'): CatalogItem {
    return { id, name, sectionId, custom: false, draft: false };
}

export function draft(id: number, name: string, sectionId = 'zuivel'): CatalogItem {
    return { ...item(id, name, sectionId), draft: true };
}

export function entry(catalogItem: CatalogItem, state: ListEntry['state'], quantity = 1, note = ''): ListEntry {
    return {
        id: note ? `entry-${catalogItem.id}-${note}` : `entry-${catalogItem.id}`,
        catalogItemId: catalogItem.id,
        catalogItem,
        state,
        quantity: state === 'recent' ? 0 : quantity,
        note,
        updatedAt: '2026-11-13T10:00:00.000Z'
    };
}

export interface FakeStore {
    sections: WritableSignal<Array<Section>>;
    items: WritableSignal<Array<CatalogItem>>;
    drafts: Signal<Array<CatalogItem>>;
    entries: WritableSignal<Array<ListEntry>>;
    inbox: WritableSignal<Array<Barcode>>;
    recipes: WritableSignal<Array<Recipe>>;
    recipeOffers: WritableSignal<Array<RecipeOffer>>;
    waiting: Signal<number>;
    saveRecipeOffer: ReturnType<typeof vi.fn>;
    dropRecipeOffer: ReturnType<typeof vi.fn>;
    loaded: WritableSignal<boolean>;
    failed: WritableSignal<boolean>;
    settled: WritableSignal<boolean>;
    online: WritableSignal<boolean>;
    updatedAt: WritableSignal<string | undefined>;
    pending: WritableSignal<Array<{ id?: string }>>;
    pendingIds: Signal<Set<string | undefined>>;
    toBuy: Signal<Array<ListEntry>>;
    recent: Signal<Array<ListEntry>>;
    toBuyGroups: Signal<Array<{ section: Section; rows: Array<ListEntry> }>>;
    itemGroups: Signal<Array<{ section: Section; rows: Array<CatalogItem> }>>;
    itemById: (id: number) => CatalogItem | undefined;
    recipeById: (id: number) => Recipe | undefined;
    holdsDraft: (recipe: RecipeContent) => boolean;
    confirmDraft: ReturnType<typeof vi.fn>;
    replaceDraft: ReturnType<typeof vi.fn>;
    saveRecipe: ReturnType<typeof vi.fn>;
    importRecipe: ReturnType<typeof vi.fn>;
    deleteRecipe: ReturnType<typeof vi.fn>;
    putRecipeOnList: ReturnType<typeof vi.fn>;
    undoLastScan: ReturnType<typeof vi.fn>;
    changeEntry: ReturnType<typeof vi.fn>;
    addItem: ReturnType<typeof vi.fn>;
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
    const pending = signal<Array<{ id?: string }>>([]);
    const recipes = signal<Array<Recipe>>([]);
    const recipeOffers = signal<Array<RecipeOffer>>([]);
    const inbox = signal<Array<Barcode>>([]);
    const toBuy = computed(() => list().filter((row) => row.state === 'to_buy'));
    const group = <T>(rows: Array<T>, sectionOf: (row: T) => string): Array<{ section: Section; rows: Array<T> }> =>
        sections()
            .map((section) => ({ section, rows: rows.filter((row) => sectionOf(row) === section.id) }))
            .filter((grouped) => grouped.rows.length);

    return {
        sections,
        items: catalog,
        drafts: computed(() => catalog().filter((row) => row.draft)),
        entries: list,
        inbox,
        recipes,
        recipeOffers,
        waiting: computed(() => inbox().length + recipeOffers().length),
        saveRecipeOffer: vi.fn(),
        dropRecipeOffer: vi.fn(() => of(undefined)),
        loaded: signal(true),
        failed: signal(false),
        settled: signal(true),
        online: signal(true),
        updatedAt: signal<string | undefined>(undefined),
        pending,
        pendingIds: computed(() => new Set(pending().map((change) => change.id))),
        toBuy,
        recent: computed(() => list().filter((row) => row.state === 'recent')),
        toBuyGroups: computed(() => group(toBuy(), (row) => row.catalogItem.sectionId)),
        itemGroups: computed(() => group(catalog(), (row) => row.sectionId)),
        itemById: (id: number) => catalog().find((row) => row.id === id),
        recipeById: (id: number) => recipes().find((row) => row.id === id),
        holdsDraft: (recipe: RecipeContent) =>
            recipe.ingredients.some(({ catalogItemId }) => catalog().find((row) => row.id === catalogItemId)?.draft),
        confirmDraft: vi.fn(() => of(undefined)),
        replaceDraft: vi.fn(() => of(undefined)),
        saveRecipe: vi.fn(),
        importRecipe: vi.fn(),
        deleteRecipe: vi.fn(() => of(undefined)),
        putRecipeOnList: vi.fn(() => of(undefined)),
        undoLastScan: vi.fn(),
        changeEntry: vi.fn(() => of(undefined)),
        addItem: vi.fn(() => of(undefined)),
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
    return Array.from(root.querySelectorAll(selector), (element) =>
        (element.textContent ?? '').replace(/\s+/g, ' ').trim()
    );
}

export function click(root: Element, selector: string, index = 0): void {
    (root.querySelectorAll(selector)[index] as HTMLElement).click();
}

export function type(root: Element, selector: string, text: string): void {
    const field = root.querySelector(selector) as HTMLInputElement;
    field.value = text;
    field.dispatchEvent(new Event('input'));
}

export interface FakeRemarks {
    draft: WritableSignal<{ target?: RemarkTarget } | undefined>;
    pointing: WritableSignal<boolean>;
    waiting: WritableSignal<number>;
    ready: WritableSignal<number>;
    start: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    write: (target?: RemarkTarget) => void;
    startPointing: () => void;
    cancel: () => void;
    send: ReturnType<typeof vi.fn>;
}

export function fakeRemarks(): FakeRemarks {
    const draft = signal<{ target?: RemarkTarget } | undefined>(undefined);
    const pointing = signal(false);

    return {
        draft,
        pointing,
        waiting: signal(0),
        ready: signal(0),
        start: vi.fn(),
        count: vi.fn(),
        write: (target?: RemarkTarget): void => {
            pointing.set(false);
            draft.set({ target });
        },
        startPointing: (): void => {
            draft.set(undefined);
            pointing.set(true);
        },
        cancel: (): void => {
            pointing.set(false);
            draft.set(undefined);
        },
        send: vi.fn(() => of('sent'))
    };
}
