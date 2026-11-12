import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { ItemIconComponent } from '../../components/item-icon/item-icon.component';
import { ShoppingStore } from '../../services/shopping.store';

@Component({
    selector: 'app-catalog-page',
    standalone: true,
    imports: [FormsModule, RouterLink, TranslateModule, ItemIconComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="page">
            <h1 class="page-title">{{ 'catalog.title' | translate }}</h1>
            <input
                class="field"
                type="search"
                autocomplete="off"
                [placeholder]="'catalog.searchPlaceholder' | translate"
                [ngModel]="search()"
                (ngModelChange)="search.set($event)"
            />

            @for (group of groups(); track group.section.id) {
                <h2 class="section-title">
                    <span>{{ group.section.emoji }}</span>
                    {{ group.section.name }}
                    <span class="font-normal">({{ group.rows.length }})</span>
                </h2>
                <div class="flex flex-col gap-1">
                    @for (item of group.rows; track item.id) {
                        <a class="card flex items-center gap-3 !py-2" [routerLink]="['/catalog', item.id]">
                            <span class="h-9 w-9 shrink-0 rounded-lg p-1" style="background: var(--tile); color: var(--tile-text)">
                                <app-item-icon [item]="item" />
                            </span>
                            <span class="grow font-semibold">{{ item.name }}</span>
                            <i class="material-symbols-outlined muted">chevron_right</i>
                        </a>
                    }
                </div>
            } @empty {
                <p class="empty">{{ (store.loaded() ? 'catalog.noResults' : 'common.loading') | translate }}</p>
            }
        </div>
    `
})
export class CatalogPage {
    protected readonly store = inject(ShoppingStore);
    protected readonly search = signal('');

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
}
