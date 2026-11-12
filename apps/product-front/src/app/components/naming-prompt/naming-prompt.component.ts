import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { filter, switchMap, tap } from 'rxjs';

import { Barcode, CatalogItem, ProductSuggestion } from '../../models';
import { ApiService } from '../../services/api.service';
import { EventsService } from '../../services/events.service';
import { ShoppingStore } from '../../services/shopping.store';
import { ItemIconComponent } from '../item-icon/item-icon.component';

const MAX_MATCHES = 12;
const SECTION_KEYWORDS: Record<string, Array<string>> = {
    'zuivel': ['zuivel', 'melk', 'milk', 'kaas', 'cheese', 'yoghurt', 'yogurt', 'dair', 'eieren', 'egg', 'boter', 'butter'],
    'dranken': ['drank', 'cola', 'sap', 'juice', 'bier', 'beer', 'wijn', 'wine', 'water', 'koffie', 'coffee', 'thee', 'tea', 'beverage', 'drink', 'soda'],
    'brood-gebak': ['brood', 'bread', 'bakker', 'gebak', 'bakery', 'pastr'],
    'vlees-vis': ['vlees', 'meat', 'vis', 'fish', 'kip', 'chicken', 'worst', 'sausage', 'vega'],
    'fruit-groenten': ['fruit', 'groente', 'vegetable', 'aardappel', 'potato', 'salade', 'salad'],
    'graanproducten': ['pasta', 'rijst', 'rice', 'ontbijtgranen', 'cereal', 'muesli', 'noodle', 'meel', 'flour'],
    'snacks-snoep': ['snoep', 'candy', 'chips', 'koek', 'cookie', 'biscuit', 'chocola', 'snack', 'beleg', 'spread', 'jam', 'sweet'],
    'gereed-diepvries': ['diepvries', 'frozen', 'maaltijd', 'meal', 'pizza', 'soep', 'soup', 'ijs'],
    'ingredienten-kruiden': ['kruiden', 'spice', 'saus', 'sauce', 'olie', 'oil', 'conserven', 'canned', 'bakken', 'baking', 'suiker', 'sugar', 'azijn'],
    'huishouden': ['huishoud', 'household', 'schoonmaak', 'clean', 'wasmiddel', 'laundry', 'afwas', 'papier'],
    'verzorging-gezondheid': ['verzorging', 'drogist', 'care', 'hygi', 'shampoo', 'tand', 'health', 'baby'],
    'dierenvoeding': ['dier', 'huisdier', 'pet', 'kat', 'hond']
};

@Component({
    selector: 'app-naming-prompt',
    standalone: true,
    imports: [FormsModule, TranslateModule, ItemIconComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './naming-prompt.component.html'
})
export class NamingPromptComponent {
    public readonly code = input.required<string>();
    public readonly closed = output<CatalogItem | undefined>();

    protected readonly store = inject(ShoppingStore);
    protected readonly barcode = signal<Barcode | undefined>(undefined);
    protected readonly search = signal('');
    protected readonly creating = signal(false);
    protected readonly newSectionId = signal('');
    protected readonly newEmoji = signal('');
    protected readonly busy = signal(false);

    protected readonly suggestions = computed(() => this.barcode()?.suggestions ?? []);
    protected readonly lookupPending = computed(() => this.barcode() !== undefined && !this.barcode()?.suggestions);

    protected readonly matches = computed(() => {
        const term = this.search().trim().toLowerCase();
        const items = this.store.items();
        if (!term) {
            const sectionId = this.suggestedSectionId();
            return sectionId ? items.filter((item) => item.sectionId === sectionId).slice(0, MAX_MATCHES) : [];
        }

        return items
            .filter((item) => item.name.toLowerCase().includes(term))
            .sort((a, b) => Number(b.name.toLowerCase().startsWith(term)) - Number(a.name.toLowerCase().startsWith(term)))
            .slice(0, MAX_MATCHES);
    });

    protected readonly exactMatch = computed(() => {
        const term = this.search().trim().toLowerCase();
        return this.store.items().some((item) => item.name.toLowerCase() === term);
    });

    protected readonly suggestedSectionId = computed(() => {
        const text = this.suggestions()
            .map((suggestion) => `${suggestion.category ?? ''} ${suggestion.title}`)
            .join(' ')
            .toLowerCase();
        const match = Object.entries(SECTION_KEYWORDS).find(([, keywords]) => keywords.some((word) => text.includes(word)));

        return match?.[0];
    });

    private readonly api = inject(ApiService);
    private readonly events = inject(EventsService);

    constructor() {
        effect(() => {
            const code = this.code();
            this.barcode.set(undefined);
            this.api
                .getBarcode(code)
                .pipe(tap((barcode) => this.barcode.set(barcode)))
                .subscribe();
        });

        this.events
            .on<{ code: string }>('barcode')
            .pipe(
                filter((event) => event.code === this.code()),
                switchMap(() => this.api.getBarcode(this.code())),
                tap((barcode) => this.barcode.set(barcode)),
                takeUntilDestroyed()
            )
            .subscribe();
    }

    protected useSuggestion(suggestion: ProductSuggestion): void {
        this.search.set(suggestion.title);
    }

    protected choose(item: CatalogItem): void {
        this.busy.set(true);
        this.store
            .mapBarcode(this.code(), item.id)
            .pipe(tap(() => this.closed.emit(item)))
            .subscribe();
    }

    protected startCreating(): void {
        this.newSectionId.set(this.suggestedSectionId() ?? this.store.sections()[0]?.id ?? '');
        this.creating.set(true);
    }

    protected create(): void {
        const name = this.search().trim();
        if (!name || !this.newSectionId()) {
            return;
        }

        this.busy.set(true);
        this.store
            .createItem({ name, sectionId: this.newSectionId(), emoji: this.newEmoji().trim() || undefined })
            .pipe(
                switchMap((item) => this.store.mapBarcode(this.code(), item.id).pipe(tap(() => this.closed.emit(item))))
            )
            .subscribe();
    }
}
