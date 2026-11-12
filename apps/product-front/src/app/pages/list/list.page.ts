import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { ItemTileComponent } from '../../components/item-tile/item-tile.component';
import { NewItemFormComponent } from '../../components/new-item-form/new-item-form.component';
import { SheetComponent } from '../../components/sheet/sheet.component';
import { CatalogItem, ListEntry } from '../../models';
import { ShoppingStore } from '../../services/shopping.store';

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
    protected readonly openItemId = signal<number | undefined>(undefined);

    protected readonly creatingName = signal<string | undefined>(undefined);

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
        this.store.changeEntry(entry.catalogItemId, { state: 'recent' }).subscribe();
    }

    protected add(item: CatalogItem): void {
        this.search.set('');
        this.store.changeEntry(item.id, { state: 'to_buy', quantity: 1 }).subscribe();
    }

    protected changeQuantity(entry: ListEntry, delta: number): void {
        this.store.changeEntry(entry.catalogItemId, { quantity: Math.max(1, entry.quantity + delta) }).subscribe();
    }

    protected saveNote(entry: ListEntry, note: string): void {
        if (note !== entry.note) {
            this.store.changeEntry(entry.catalogItemId, { note }).subscribe();
        }
    }
}
