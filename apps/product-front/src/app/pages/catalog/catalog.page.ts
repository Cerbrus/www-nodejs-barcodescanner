import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { ItemTileComponent } from '../../components/item-tile/item-tile.component';
import { CatalogItem } from '../../models';
import { ShoppingStore } from '../../services/shopping.store';

@Component({
    selector: 'app-catalog-page',
    standalone: true,
    imports: [FormsModule, TranslateModule, ItemTileComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="page">
            <h1 class="page-title">{{ 'catalog.title' | translate }}</h1>
            <div class="clearable">
                <input
                    #field
                    class="field"
                    type="search"
                    autocomplete="off"
                    [placeholder]="'catalog.searchPlaceholder' | translate"
                    [ngModel]="search()"
                    (ngModelChange)="search.set($event)"
                />
                @if (search()) {
                    <button type="button" class="clear-button" [attr.aria-label]="'common.clear' | translate" (click)="search.set(''); field.focus()">
                        <i class="material-symbols-outlined">close</i>
                    </button>
                }
            </div>

            <div class="mt-3 flex flex-col gap-2">
                @for (group of groups(); track group.section.id) {
                    <section class="card !p-0">
                        <button
                            type="button"
                            class="flex w-full items-center gap-2 p-3 text-left"
                            [attr.aria-expanded]="isOpen(group.section.id)"
                            (click)="toggle(group.section.id)"
                        >
                            <span class="text-xl">{{ group.section.emoji }}</span>
                            <span class="grow font-semibold">{{ group.section.name }}</span>
                            <span class="muted text-sm">{{ group.rows.length }}</span>
                            <i class="material-symbols-outlined muted">
                                {{ isOpen(group.section.id) ? 'expand_less' : 'expand_more' }}
                            </i>
                        </button>
                        @if (isOpen(group.section.id)) {
                            <div class="tile-grid p-3 pt-0">
                                @for (item of group.rows; track item.id) {
                                    <app-item-tile [item]="item" (selected)="openItem(item)" />
                                }
                            </div>
                        }
                    </section>
                } @empty {
                    <p class="empty">{{ (store.loaded() ? 'catalog.noResults' : 'common.loading') | translate }}</p>
                }
            </div>
        </div>
    `
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
