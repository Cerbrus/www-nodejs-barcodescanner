import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { tap } from 'rxjs';

import { ItemTileComponent } from '../../components/item-tile/item-tile.component';
import { NewItemFormComponent } from '../../components/new-item-form/new-item-form.component';
import { SheetComponent } from '../../components/sheet/sheet.component';
import { FocusOnShowDirective } from '../../directives/focus-on-show.directive';
import { withNote } from '../../display-name';
import { CatalogItem, ListEntry } from '../../models';
import { ShoppingStore } from '../../services/shopping.store';
import { ToastService } from '../../services/toast.service';

const MAX_SEARCH_RESULTS = 24;

interface SearchResult {
    key: string;
    item: CatalogItem;
    entry?: ListEntry;
}

@Component({
    selector: 'app-list-page',
    standalone: true,
    imports: [
        FormsModule,
        RouterLink,
        TranslatePipe,
        ItemTileComponent,
        NewItemFormComponent,
        SheetComponent,
        FocusOnShowDirective
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './list.page.html'
})
export class ListPage {
    protected readonly store = inject(ShoppingStore);
    protected readonly search = signal('');

    private readonly toasts = inject(ToastService);
    private readonly translate = inject(TranslateService);

    protected readonly openEntryId = signal<string | undefined>(undefined);

    protected readonly creatingName = signal<string | undefined>(undefined);
    protected readonly confirmingRemove = signal(false);
    protected readonly entryNote = viewChild<ElementRef<HTMLInputElement>>('note');

    protected readonly canCreate = computed(() => {
        const term = this.search().trim().toLowerCase();
        return term.length && !this.store.items().some((item) => item.name.toLowerCase() === term);
    });

    protected readonly openEntry = computed(() =>
        this.store.entries().find((entry) => entry.id === this.openEntryId())
    );

    protected readonly searchResults = computed(() => {
        const term = this.search().trim().toLowerCase();
        if (!term) {
            return [];
        }

        const toBuy = this.store.toBuy();
        return this.store
            .items()
            .filter((item) => !item.draft && item.name.toLowerCase().includes(term))
            .slice(0, MAX_SEARCH_RESULTS)
            .flatMap((item): Array<SearchResult> => {
                const lines = toBuy
                    .filter((entry) => entry.catalogItemId === item.id)
                    .sort((a, b) => a.note.localeCompare(b.note))
                    .map((entry) => ({ key: entry.id, item, entry }));

                return lines.some((line) => !line.entry.note) ? lines : [...lines, { key: `new-${item.id}`, item }];
            });
    });

    protected checkOff(entry: ListEntry): void {
        this.store
            .changeEntry(entry.id, { state: 'recent' })
            .pipe(
                tap(() =>
                    this.toasts.show({
                        kind: 'ok',
                        text: this.translate.instant('list.checkedOff', {
                            name: this.nameOf(entry)
                        }),
                        actionLabel: this.translate.instant('history.undo'),
                        actionIcon: 'undo',
                        action: () => this.putBack(entry)
                    })
                )
            )
            .subscribe();
    }

    protected nameOf(entry: ListEntry): string {
        return withNote(entry.catalogItem.name, entry.note);
    }

    protected add(item: CatalogItem): void {
        this.search.set('');
        this.store.addItem(item).subscribe();
    }

    protected addAgain(entry: ListEntry): void {
        this.store.changeEntry(entry.id, { state: 'to_buy', quantity: 1 }).subscribe();
    }

    protected addOneMore(entry: ListEntry): void {
        this.search.set('');
        this.changeQuantity(entry, 1);
    }

    protected closeEntry(): void {
        this.confirmingRemove.set(false);
        this.openEntryId.set(undefined);
    }

    protected decrease(entry: ListEntry): void {
        if (entry.quantity <= 1) {
            this.closeEntry();
            this.checkOff(entry);
        } else {
            this.changeQuantity(entry, -1);
        }
    }

    protected remove(entry: ListEntry): void {
        this.closeEntry();
        this.store.removeEntry(entry.id).subscribe();
    }

    protected changeQuantity(entry: ListEntry, delta: number): void {
        this.store.changeEntry(entry.id, { quantity: Math.max(1, entry.quantity + delta) }).subscribe();
    }

    protected saveNote(entry: ListEntry, note: string): void {
        if (note !== entry.note) {
            this.store.changeEntry(entry.id, { note }).subscribe();
        }
    }

    private putBack(entry: ListEntry): void {
        this.store.changeEntry(entry.id, { state: 'to_buy', quantity: entry.quantity, note: entry.note }).subscribe();
    }
}
