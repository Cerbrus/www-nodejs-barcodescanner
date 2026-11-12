import { ChangeDetectionStrategy, Component, computed, inject, input, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { CatalogItem } from '../../models';
import { ShoppingStore } from '../../services/shopping.store';
import { ItemIconComponent } from '../item-icon/item-icon.component';

const MAX_OPTIONS = 8;

@Component({
    selector: 'app-item-autocomplete',
    standalone: true,
    imports: [FormsModule, TranslateModule, ItemIconComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="wrap">
            <div class="clearable">
                <input
                    #field
                    class="field"
                    type="search"
                    autocomplete="off"
                    autocapitalize="sentences"
                    role="combobox"
                    [attr.aria-expanded]="open()"
                    [placeholder]="placeholder()"
                    [ngModel]="text()"
                    (ngModelChange)="text.set($event); focused.set(true)"
                    (focus)="focused.set(true)"
                    (keydown.enter)="$event.preventDefault(); pickFirst()"
                    (keydown.escape)="focused.set(false)"
                />
                @if (text()) {
                    <button type="button" class="clear-button" [attr.aria-label]="'common.clear' | translate" (click)="text.set(''); field.focus()">
                        <i class="material-symbols-outlined">close</i>
                    </button>
                }
            </div>
            @if (open()) {
                <div class="options" role="listbox">
                    @for (item of options(); track item.id) {
                        <button type="button" class="option" role="option" (click)="pick(item)">
                            <span class="option-icon"><app-item-icon [item]="item" /></span>
                            <span class="grow">{{ item.name }}</span>
                        </button>
                    }
                    @if (canCreate()) {
                        <button type="button" class="option create" role="option" (click)="createNew()">
                            <i class="material-symbols-outlined">add_circle</i>
                            <span class="grow">{{ 'naming.newItem' | translate: { name: text().trim() } }}</span>
                        </button>
                    }
                    @if (!options().length && !canCreate()) {
                        <p class="none">{{ 'naming.noMatches' | translate }}</p>
                    }
                </div>
            }
        </div>
    `,
    styles: `
        .wrap { position: relative; }
        .options {
            margin-top: 4px; padding: 4px;
            border: 1px solid var(--line); border-radius: 12px; background: var(--surface);
        }
        .option {
            display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px;
            border-radius: 8px; font-weight: 600; text-align: left;
        }
        .option:hover, .option:focus-visible { background: var(--page); }
        .option-icon { width: 32px; height: 32px; flex: 0 0 auto; padding: 4px; border-radius: 8px; background: var(--tile-neutral); color: var(--tile-text); }
        .option.create { color: var(--accent); }
        .option.create i { width: 32px; font-size: 26px; text-align: center; }
        .none { padding: 8px; color: var(--text-muted); font-size: 0.9rem; }
    `
})
export class ItemAutocompleteComponent {
    public readonly text = model('');
    public readonly placeholder = input('');
    public readonly allowCreate = input(false);
    public readonly excludeId = input<number | undefined>(undefined);

    public readonly picked = output<CatalogItem>();
    public readonly create = output<string>();

    protected readonly focused = signal(false);
    protected readonly open = computed(() => this.focused() && this.text().trim().length > 0);

    protected readonly options = computed(() => {
        const term = this.text().trim().toLowerCase();
        if (!term) {
            return [];
        }

        return this.store
            .items()
            .filter((item) => item.id !== this.excludeId() && item.name.toLowerCase().includes(term))
            .sort((a, b) => this.rank(a, term) - this.rank(b, term) || a.name.localeCompare(b.name))
            .slice(0, MAX_OPTIONS);
    });

    protected readonly canCreate = computed(() => {
        const term = this.text().trim().toLowerCase();
        return this.allowCreate() && term.length > 0 && !this.store.items().some((item) => item.name.toLowerCase() === term);
    });

    private readonly store = inject(ShoppingStore);

    protected pick(item: CatalogItem): void {
        this.focused.set(false);
        this.picked.emit(item);
    }

    protected pickFirst(): void {
        const first = this.options()[0];
        if (first) {
            this.pick(first);
        } else if (this.canCreate()) {
            this.createNew();
        }
    }

    protected createNew(): void {
        this.focused.set(false);
        this.create.emit(this.text().trim());
    }

    private rank(item: CatalogItem, term: string): number {
        const name = item.name.toLowerCase();
        return name === term ? 0 : name.startsWith(term) ? 1 : 2;
    }
}
