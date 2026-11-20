import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    input,
    linkedSignal,
    output,
    signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { finalize, tap } from 'rxjs';

import { CatalogItem } from '../../models';
import { ShoppingStore } from '../../services/shopping.store';
import { IconPickerComponent } from '../icon-picker/icon-picker.component';
import { ItemIconComponent } from '../item-icon/item-icon.component';

const SECTION_KEYWORDS: Record<string, Array<string>> = {
    zuivel: [
        'zuivel',
        'melk',
        'milk',
        'kaas',
        'cheese',
        'yoghurt',
        'yogurt',
        'dair',
        'eieren',
        'egg',
        'boter',
        'butter'
    ],
    dranken: [
        'drank',
        'cola',
        'sap',
        'juice',
        'bier',
        'beer',
        'wijn',
        'wine',
        'water',
        'koffie',
        'coffee',
        'thee',
        'tea',
        'beverage',
        'drink',
        'soda'
    ],
    'brood-gebak': ['brood', 'bread', 'bakker', 'gebak', 'bakery', 'pastr'],
    'vlees-vis': ['vlees', 'meat', 'vis', 'fish', 'kip', 'chicken', 'worst', 'sausage', 'vega'],
    'fruit-groenten': [
        'fruit',
        'groente',
        'vegetable',
        'aardappel',
        'potato',
        'salade',
        'salad',
        'peen',
        'wortel',
        'kool',
        'appel',
        'sla'
    ],
    graanproducten: ['pasta', 'rijst', 'rice', 'ontbijtgranen', 'cereal', 'muesli', 'noodle', 'meel', 'flour'],
    'snacks-snoep': [
        'snoep',
        'candy',
        'chips',
        'koek',
        'cookie',
        'biscuit',
        'chocola',
        'snack',
        'beleg',
        'spread',
        'jam',
        'sweet'
    ],
    'gereed-diepvries': ['diepvries', 'frozen', 'maaltijd', 'meal', 'pizza', 'soep', 'soup', 'ijs'],
    'ingredienten-kruiden': [
        'kruiden',
        'spice',
        'saus',
        'sauce',
        'olie',
        'oil',
        'conserven',
        'canned',
        'bakken',
        'baking',
        'suiker',
        'sugar',
        'azijn'
    ],
    huishouden: ['huishoud', 'household', 'schoonmaak', 'clean', 'wasmiddel', 'laundry', 'afwas', 'papier'],
    'verzorging-gezondheid': ['verzorging', 'drogist', 'care', 'hygi', 'shampoo', 'tand', 'health', 'baby'],
    dierenvoeding: ['dier', 'huisdier', 'pet', 'kat', 'hond']
};

@Component({
    selector: 'app-new-item-form',
    standalone: true,
    imports: [FormsModule, TranslatePipe, IconPickerComponent, ItemIconComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './new-item-form.component.html'
})
export class NewItemFormComponent {
    public readonly initialName = input.required<string>();
    public readonly hint = input('');
    public readonly shopSectionId = input<string>();
    public readonly submitLabel = input.required<string>();
    public readonly submitIcon = input('add');

    public readonly created = output<CatalogItem>();
    public readonly cancelled = output<void>();

    protected readonly store = inject(ShoppingStore);
    protected readonly name = linkedSignal(() => this.initialName());
    protected readonly sectionId = linkedSignal(() => this.guessedSectionId() ?? this.store.sections()[0]?.id ?? '');
    protected readonly icon = signal('');
    protected readonly emoji = signal('');
    protected readonly pickingIcon = signal(false);
    protected readonly busy = signal(false);

    protected readonly preview = computed(() => ({
        name: this.name() || '?',
        icon: this.icon() || undefined,
        emoji: this.emoji() || undefined
    }));

    private readonly guessedSectionId = computed(() => {
        const shopSectionId = this.shopSectionId();
        if (shopSectionId && this.store.sections().some((section) => section.id === shopSectionId)) {
            return shopSectionId;
        }

        const text = `${this.hint()} ${this.initialName()}`.toLowerCase();
        return Object.entries(SECTION_KEYWORDS).find(([, keywords]) =>
            keywords.some((word) => text.includes(word))
        )?.[0];
    });

    protected chooseIcon(icon: string): void {
        this.icon.set(icon);
        this.pickingIcon.set(false);
    }

    protected create(): void {
        this.busy.set(true);
        this.store
            .createItem({
                name: this.name().trim(),
                sectionId: this.sectionId(),
                icon: this.icon() || undefined,
                emoji: this.emoji().trim() || undefined
            })
            .pipe(
                tap((item) => this.created.emit(item)),
                finalize(() => this.busy.set(false))
            )
            .subscribe();
    }
}
