import { ChangeDetectionStrategy, Component, computed, inject, input, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';

import { CatalogItem } from '../../models';
import { ShoppingStore } from '../../services/shopping.store';
import { ItemIconComponent } from '../item-icon/item-icon.component';

const MAX_OPTIONS = 8;

@Component({
    selector: 'app-item-autocomplete',
    standalone: true,
    imports: [FormsModule, TranslatePipe, ItemIconComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './item-autocomplete.component.html',
    styleUrl: './item-autocomplete.component.scss'
})
export class ItemAutocompleteComponent {
    public readonly text = model('');
    public readonly placeholder = input('');
    public readonly allowCreate = input(false);
    public readonly excludeId = input<number | undefined>(undefined);
    public readonly includeDrafts = input(false);

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
            .filter(
                (item) =>
                    item.id !== this.excludeId() &&
                    (this.includeDrafts() || !item.draft) &&
                    item.name.toLowerCase().includes(term)
            )
            .sort((a, b) => this.rank(a, term) - this.rank(b, term) || a.name.localeCompare(b.name))
            .slice(0, MAX_OPTIONS);
    });

    protected readonly canCreate = computed(() => {
        const term = this.text().trim().toLowerCase();
        return (
            this.allowCreate() &&
            term.length > 0 &&
            !this.store.items().some((item) => item.name.toLowerCase() === term)
        );
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
