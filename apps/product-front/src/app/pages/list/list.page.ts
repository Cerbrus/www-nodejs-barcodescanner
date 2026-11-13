import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { tap } from 'rxjs';

import { ItemTileComponent } from '../../components/item-tile/item-tile.component';
import { NewItemFormComponent } from '../../components/new-item-form/new-item-form.component';
import { SheetComponent } from '../../components/sheet/sheet.component';
import { CatalogItem, ListEntry } from '../../models';
import { ShoppingStore } from '../../services/shopping.store';
import { ToastService } from '../../services/toast.service';

const MAX_SEARCH_RESULTS = 24;

@Component({
    selector: 'app-list-page',
    standalone: true,
    imports: [FormsModule, RouterLink, TranslateModule, ItemTileComponent, NewItemFormComponent, SheetComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './list.page.html'
})
export class ListPage {
    protected readonly store = inject(ShoppingStore);
    protected readonly search = signal('');

    private readonly toasts = inject(ToastService);
    private readonly translate = inject(TranslateService);

    protected readonly openItemId = signal<number | undefined>(undefined);

    protected readonly creatingName = signal<string | undefined>(undefined);
    protected readonly confirmingRemove = signal(false);

    protected readonly canCreate = computed(() => {
        const term = this.search().trim().toLowerCase();
        return term.length && !this.store.items().some((item) => item.name.toLowerCase() === term);
    });

    protected readonly openEntry = computed(() =>
        this.store.entries().find((entry) => entry.catalogItemId === this.openItemId())
    );

    protected readonly searchResults = computed(() => {
        const term = this.search().trim().toLowerCase();
        if (!term) {
            return [];
        }

        const toBuyIds = new Set(this.store.toBuy().map((entry) => entry.catalogItemId));
        return this.store
            .items()
            .filter((item) => item.name.toLowerCase().includes(term) && !toBuyIds.has(item.id))
            .slice(0, MAX_SEARCH_RESULTS);
    });

    protected checkOff(entry: ListEntry): void {
        this.store
            .changeEntry(entry.catalogItemId, { state: 'recent' })
            .pipe(
                tap(() =>
                    this.toasts.show({
                        kind: 'ok',
                        text: this.translate.instant('list.checkedOff', { name: entry.catalogItem.name }),
                        actionLabel: this.translate.instant('history.undo'),
                        action: () => this.putBack(entry)
                    })
                )
            )
            .subscribe();
    }

    protected add(item: CatalogItem): void {
        this.search.set('');
        this.store.changeEntry(item.id, { state: 'to_buy', quantity: 1 }).subscribe();
    }

    protected closeEntry(): void {
        this.confirmingRemove.set(false);
        this.openItemId.set(undefined);
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
        this.store.removeEntry(entry.catalogItemId).subscribe();
    }

    protected changeQuantity(entry: ListEntry, delta: number): void {
        this.store.changeEntry(entry.catalogItemId, { quantity: Math.max(1, entry.quantity + delta) }).subscribe();
    }

    protected saveNote(entry: ListEntry, note: string): void {
        if (note !== entry.note) {
            this.store.changeEntry(entry.catalogItemId, { note }).subscribe();
        }
    }

    private putBack(entry: ListEntry): void {
        this.store.changeEntry(entry.catalogItemId, { state: 'to_buy', quantity: entry.quantity, note: entry.note }).subscribe();
    }
}
