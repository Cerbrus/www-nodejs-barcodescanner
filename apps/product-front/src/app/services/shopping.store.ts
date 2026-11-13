import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, debounceTime, filter, forkJoin, interval, map, of, switchMap, tap } from 'rxjs';

import { Barcode, CatalogItem, CatalogItemInput, ListEntry, ListEntryChange, Section } from '../models';
import { ApiService } from './api.service';
import { EventsService } from './events.service';
import { loadSnapshot, saveSnapshot } from './snapshot';

export interface SectionGroup<T> {
    section: Section;
    rows: Array<T>;
}

const REFRESH_DELAY_MILLISECONDS = 150;
const RETRY_MILLISECONDS = 5000;

@Injectable({ providedIn: 'root' })
export class ShoppingStore {
    public readonly sections = signal<Array<Section>>([]);
    public readonly items = signal<Array<CatalogItem>>([]);
    public readonly entries = signal<Array<ListEntry>>([]);
    public readonly inbox = signal<Array<Barcode>>([]);
    public readonly loaded = signal(false);
    public readonly failed = signal(false);
    public readonly settled = signal(false);
    public readonly updatedAt = signal<string | undefined>(undefined);

    public readonly toBuy = computed(() => this.entries().filter((entry) => entry.state === 'to_buy'));
    public readonly recent = computed(() => this.entries().filter((entry) => entry.state === 'recent'));
    public readonly toBuyGroups = computed(() => this.groupBySection(this.toBuy(), (entry) => entry.catalogItem.sectionId));
    public readonly itemGroups = computed(() => this.groupBySection(this.items(), (item) => item.sectionId));
    public readonly online = computed(() => this.events.connected() && !this.failed());

    private readonly api = inject(ApiService);
    private readonly events = inject(EventsService);

    constructor() {
        this.restore();
        this.refreshAll().subscribe();

        this.events
            .on('list', 'scan', 'barcode')
            .pipe(
                debounceTime(REFRESH_DELAY_MILLISECONDS),
                switchMap(() => this.refreshListAndInbox())
            )
            .subscribe();

        this.events
            .on('catalog')
            .pipe(
                debounceTime(REFRESH_DELAY_MILLISECONDS),
                switchMap(() => this.refreshAll())
            )
            .subscribe();

        this.events.resumed.pipe(switchMap(() => this.refreshAll())).subscribe();

        interval(RETRY_MILLISECONDS)
            .pipe(
                filter(() => this.failed()),
                switchMap(() => this.refreshAll())
            )
            .subscribe();
    }

    public itemById(id: number): CatalogItem | undefined {
        return this.items().find((item) => item.id === id);
    }

    public refreshAll(): Observable<void> {
        return forkJoin([this.api.getSections(), this.api.getCatalog(), this.api.getList(), this.api.getInbox()]).pipe(
            tap(([sections, items, entries, inbox]) => {
                this.sections.set(sections);
                this.items.set(items);
                this.entries.set(entries);
                this.inbox.set(inbox);
                this.loaded.set(true);
                this.remember();
            }),
            map(() => undefined),
            catchError(() => this.markFailed())
        );
    }

    public refreshListAndInbox(): Observable<void> {
        return forkJoin([this.api.getList(), this.api.getInbox()]).pipe(
            tap(([entries, inbox]) => {
                this.entries.set(entries);
                this.inbox.set(inbox);
                this.remember();
            }),
            map(() => undefined),
            catchError(() => this.markFailed())
        );
    }

    public changeEntry(catalogItemId: number, change: ListEntryChange): Observable<void> {
        return this.api.changeListEntry(catalogItemId, change).pipe(switchMap(() => this.refreshListAndInbox()));
    }

    public removeEntry(catalogItemId: number): Observable<void> {
        return this.api.removeListEntry(catalogItemId).pipe(switchMap(() => this.refreshListAndInbox()));
    }

    public mapBarcode(code: string, catalogItemId: number): Observable<void> {
        return this.api.mapBarcode(code, catalogItemId).pipe(switchMap(() => this.refreshListAndInbox()));
    }

    public createItem(input: CatalogItemInput): Observable<CatalogItem> {
        return this.api
            .createCatalogItem(input)
            .pipe(switchMap((item) => this.refreshAll().pipe(map(() => item))));
    }

    private restore(): void {
        const snapshot = loadSnapshot();
        if (!snapshot) {
            return;
        }

        this.sections.set(snapshot.sections);
        this.items.set(snapshot.items);
        this.entries.set(snapshot.entries);
        this.inbox.set(snapshot.inbox);
        this.updatedAt.set(snapshot.savedAt);
        this.loaded.set(true);
    }

    private remember(): void {
        const savedAt = new Date().toISOString();
        this.failed.set(false);
        this.settled.set(true);
        this.updatedAt.set(savedAt);
        saveSnapshot({ savedAt, sections: this.sections(), items: this.items(), entries: this.entries(), inbox: this.inbox() });
    }

    private markFailed(): Observable<void> {
        this.settled.set(true);
        this.failed.set(true);
        return of(undefined);
    }

    private groupBySection<T>(rows: Array<T>, sectionIdOf: (row: T) => string): Array<SectionGroup<T>> {
        return this.sections()
            .map((section) => ({ section, rows: rows.filter((row) => sectionIdOf(row) === section.id) }))
            .filter((group) => group.rows.length);
    }
}
