import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import {
    Observable,
    TimeoutError,
    catchError,
    debounceTime,
    defer,
    filter,
    forkJoin,
    fromEvent,
    interval,
    map,
    of,
    switchMap,
    tap,
    throwError,
    timeout
} from 'rxjs';

import { RecipeContent } from '@barcodescanner/shared';

import {
    Barcode,
    CatalogItem,
    CatalogItemInput,
    ListEntry,
    ListEntryChange,
    Recipe,
    RecipeInput,
    RecipeOffer,
    Section
} from '../models';
import { ApiService } from './api.service';
import { EventsService } from './events.service';
import { PendingChange, loadOutbox, saveOutbox } from './outbox';
import { loadSnapshot, saveSnapshot } from './snapshot';
import { ToastService } from './toast.service';

export interface SectionGroup<T> {
    section: Section;
    rows: Array<T>;
}

const REFRESH_DELAY_MILLISECONDS = 150;
const RETRY_MILLISECONDS = 5000;
const ANSWER_WAIT_MILLISECONDS = 5000;
const NO_CONNECTION = 0;

@Injectable({ providedIn: 'root' })
export class ShoppingStore {
    public readonly sections = signal<Array<Section>>([]);
    public readonly items = signal<Array<CatalogItem>>([]);
    public readonly entries = signal<Array<ListEntry>>([]);
    public readonly inbox = signal<Array<Barcode>>([]);
    public readonly recipes = signal<Array<Recipe>>([]);
    public readonly recipeOffers = signal<Array<RecipeOffer>>([]);
    public readonly waiting = computed(() => this.inbox().length + this.recipeOffers().length);
    public readonly collecting = signal(false);
    public readonly loaded = signal(false);
    public readonly failed = signal(false);
    public readonly settled = signal(false);
    public readonly updatedAt = signal<string | undefined>(undefined);
    public readonly pending = signal<Array<PendingChange>>(loadOutbox());
    public readonly pendingIds = computed(() => new Set(this.pending().map((change) => change.id)));

    public readonly toBuy = computed(() => this.entries().filter((entry) => entry.state === 'to_buy'));
    public readonly recent = computed(() => this.entries().filter((entry) => entry.state === 'recent'));
    public readonly toBuyGroups = computed(() =>
        this.groupBySection(this.toBuy(), (entry) => entry.catalogItem.sectionId)
    );

    public readonly itemGroups = computed(() => this.groupBySection(this.items(), (item) => item.sectionId));
    public readonly online = computed(() => this.events.connected() && !this.failed());

    private readonly api = inject(ApiService);
    private readonly events = inject(EventsService);
    private readonly toasts = inject(ToastService);
    private readonly translate = inject(TranslateService);

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
            .on('recipe')
            .pipe(
                debounceTime(REFRESH_DELAY_MILLISECONDS),
                switchMap(() => this.refreshRecipes())
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
        fromEvent(window, 'online')
            .pipe(switchMap(() => this.refreshAll()))
            .subscribe();

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

    public recipeById(id: number): Recipe | undefined {
        return this.recipes().find((recipe) => recipe.id === id);
    }

    public refreshAll(): Observable<void> {
        return this.sendPending().pipe(
            switchMap(() =>
                forkJoin([
                    this.api.getSections(),
                    this.api.getCatalog(),
                    this.api.getList(),
                    this.api.getInbox(),
                    this.api.getRecipes(),
                    this.api.getRecipeOffers()
                ])
            ),
            timeout(ANSWER_WAIT_MILLISECONDS),
            tap(([sections, items, entries, inbox, recipes, recipeOffers]) => {
                this.recipes.set(recipes);
                this.recipeOffers.set(recipeOffers);
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
        return this.sendPending().pipe(
            switchMap(() => forkJoin([this.api.getList(), this.api.getInbox()])),
            timeout(ANSWER_WAIT_MILLISECONDS),
            tap(([entries, inbox]) => {
                this.entries.set(entries);
                this.inbox.set(inbox);
                this.remember();
            }),
            map(() => undefined),
            catchError(() => this.markFailed())
        );
    }

    public changeEntry(id: string, change: ListEntryChange): Observable<void> {
        if (this.pending().length || !navigator.onLine || !this.online()) {
            return this.keepForLater(id, change);
        }

        const before = this.entries();
        this.entries.update((entries) => this.withLocalChange(entries, id, change));

        return this.api.changeListEntry(id, change).pipe(
            timeout(ANSWER_WAIT_MILLISECONDS),
            switchMap(() => this.refreshListAndInbox()),
            catchError((error: HttpErrorResponse | TimeoutError) => {
                this.entries.set(before);
                const unanswered = error instanceof TimeoutError || error.status === NO_CONNECTION;

                return unanswered ? this.keepForLater(id, change) : throwError(() => error);
            })
        );
    }

    public addItem(item: CatalogItem, note = ''): Observable<void> {
        const entry = this.entries().find((row) => row.catalogItemId === item.id && row.note === note.trim());
        if (entry?.state === 'to_buy') {
            return this.changeEntry(entry.id, { quantity: entry.quantity + 1 });
        }

        return this.changeEntry(entry?.id ?? crypto.randomUUID(), {
            catalogItemId: item.id,
            note: note.trim(),
            state: 'to_buy',
            quantity: 1
        });
    }

    public forgetLocalData(): void {
        this.pending.set([]);
        saveOutbox([]);
    }

    public removeEntry(id: string): Observable<void> {
        return this.api.removeListEntry(id).pipe(switchMap(() => this.refreshListAndInbox()));
    }

    public mapBarcode(code: string, catalogItemId: number, note = ''): Observable<void> {
        return this.api.mapBarcode(code, catalogItemId, note).pipe(switchMap(() => this.refreshListAndInbox()));
    }

    public saveRecipe(id: number | undefined, input: RecipeInput): Observable<Recipe> {
        const saved = id === undefined ? this.api.createRecipe(input) : this.api.updateRecipe(id, input);

        return saved.pipe(switchMap((recipe) => this.refreshRecipes().pipe(map(() => recipe))));
    }

    public deleteRecipe(id: number): Observable<void> {
        return this.api.deleteRecipe(id).pipe(switchMap(() => this.refreshRecipes()));
    }

    public saveRecipeOffer(id: number): Observable<Recipe> {
        return this.api.saveRecipeOffer(id).pipe(switchMap((recipe) => this.refreshRecipes().pipe(map(() => recipe))));
    }

    public dropRecipeOffer(id: number): Observable<void> {
        return this.api.dropRecipeOffer(id).pipe(switchMap(() => this.refreshRecipes()));
    }

    public putRecipeOnList(recipe: RecipeContent): Observable<void> {
        return this.api.addRecipe(recipe).pipe(
            tap((outcome) =>
                this.toasts.show({
                    kind: outcome.unknown?.length ? 'attention' : 'ok',
                    text: this.translate.instant(outcome.unknown?.length ? 'recipe.addedPartly' : 'recipe.added', {
                        name: outcome.title,
                        count: outcome.added,
                        unknown: outcome.unknown?.length
                    }),
                    actionLabel: this.translate.instant('history.undo'),
                    action: () => this.undoLastScan()
                })
            ),
            switchMap(() => this.refreshListAndInbox())
        );
    }

    public undoLastScan(): void {
        this.api
            .undoScan()
            .pipe(switchMap(() => this.refreshListAndInbox()))
            .subscribe();
    }

    public createItem(input: CatalogItemInput): Observable<CatalogItem> {
        return this.api.createCatalogItem(input).pipe(switchMap((item) => this.refreshAll().pipe(map(() => item))));
    }

    private refreshRecipes(): Observable<void> {
        return forkJoin([this.api.getRecipes(), this.api.getRecipeOffers()]).pipe(
            tap(([recipes, recipeOffers]) => {
                this.recipes.set(recipes);
                this.recipeOffers.set(recipeOffers);
                this.saveSnapshotNow(this.updatedAt() ?? new Date().toISOString());
            }),
            map(() => undefined),
            catchError(() => of(undefined))
        );
    }

    private keepForLater(id: string, change: ListEntryChange): Observable<void> {
        this.pending.update((pending) => [...pending, { ...change, id, changedAt: new Date().toISOString() }]);
        saveOutbox(this.pending());
        this.entries.update((entries) => this.withLocalChange(entries, id, change));
        this.saveSnapshotNow(this.updatedAt() ?? new Date().toISOString());
        this.failed.set(true);
        this.settled.set(true);

        return of(undefined);
    }

    private withLocalChange(entries: Array<ListEntry>, id: string, change: ListEntryChange): Array<ListEntry> {
        const current = entries.find((entry) => entry.id === id);
        const catalogItem = current?.catalogItem ?? this.itemById(change.catalogItemId ?? -1);
        if (!catalogItem) {
            return entries;
        }

        const note = (change.note ?? current?.note ?? '').trim();
        const variant = entries.find(
            (entry) => entry.id !== id && entry.catalogItemId === catalogItem.id && entry.note === note
        );
        const state = change.state ?? current?.state ?? 'to_buy';
        const quantity = state === 'recent' ? 0 : Math.max(1, change.quantity ?? current?.quantity ?? 1);
        const together = variant?.state === 'to_buy' && state === 'to_buy' ? variant.quantity + quantity : quantity;
        const changed: ListEntry = {
            id: variant?.id ?? id,
            catalogItemId: catalogItem.id,
            catalogItem,
            state: variant && state === 'recent' ? variant.state : state,
            quantity: variant && state === 'recent' ? variant.quantity : together,
            note,
            updatedAt: new Date().toISOString()
        };

        return [changed, ...entries.filter((entry) => entry.id !== id && entry.id !== changed.id)];
    }

    private sendPending(): Observable<void> {
        return defer(() => {
            const changes = this.pending();
            if (!changes.length) {
                return of(undefined);
            }

            return this.api.sendOfflineChanges(changes).pipe(
                tap((result) => {
                    this.pending.update((pending) => pending.slice(changes.length));
                    saveOutbox(this.pending());
                    if (result.skipped.length) {
                        this.toasts.show({ kind: 'attention', text: this.translate.instant('offline.serverWon') });
                    }
                }),
                map(() => undefined)
            );
        });
    }

    private saveSnapshotNow(savedAt: string): void {
        saveSnapshot({
            savedAt,
            sections: this.sections(),
            items: this.items(),
            entries: this.entries(),
            inbox: this.inbox(),
            recipes: this.recipes(),
            recipeOffers: this.recipeOffers()
        });
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
        this.recipes.set(snapshot.recipes ?? []);
        this.recipeOffers.set(snapshot.recipeOffers ?? []);
        this.updatedAt.set(snapshot.savedAt);
        this.loaded.set(true);
    }

    private remember(): void {
        const savedAt = new Date().toISOString();
        this.failed.set(false);
        this.settled.set(true);
        this.updatedAt.set(savedAt);
        this.saveSnapshotNow(savedAt);
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
