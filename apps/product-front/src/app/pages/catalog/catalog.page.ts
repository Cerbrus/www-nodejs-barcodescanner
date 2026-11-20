import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { ItemTileComponent } from '../../components/item-tile/item-tile.component';
import { CatalogItem } from '../../models';
import { ShoppingStore } from '../../services/shopping.store';

@Component({
    selector: 'app-catalog-page',
    standalone: true,
    imports: [FormsModule, TranslatePipe, ItemTileComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './catalog.page.html'
})
export class CatalogPage {
    protected readonly store = inject(ShoppingStore);
    protected readonly search = signal('');
    protected readonly openSections = signal<ReadonlySet<string>>(new Set());

    protected readonly groups = computed(() => {
        const term = this.search().trim().toLowerCase();
        return this.store
            .itemGroups()
            .map((group) => ({
                section: group.section,
                rows: term ? group.rows.filter((item) => item.name.toLowerCase().includes(term)) : group.rows
            }))
            .filter((group) => group.rows.length);
    });

    private readonly router = inject(Router);

    protected isOpen(sectionId: string): boolean {
        return this.search().trim().length > 0 || this.openSections().has(sectionId);
    }

    protected toggle(sectionId: string): void {
        this.openSections.update((open) => {
            const next = new Set(open);
            if (!next.delete(sectionId)) {
                next.add(sectionId);
            }
            return next;
        });
    }

    protected openItem(item: CatalogItem): void {
        this.router.navigate(['/catalog', item.id]);
    }
}
