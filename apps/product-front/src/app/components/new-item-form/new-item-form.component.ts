import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { finalize, tap } from 'rxjs';

import { CatalogItem } from '../../models';
import { ShoppingStore } from '../../services/shopping.store';
import { IconPickerComponent } from '../icon-picker/icon-picker.component';
import { ItemIconComponent } from '../item-icon/item-icon.component';

const SECTION_KEYWORDS: Record<string, Array<string>> = {
    'zuivel': ['zuivel', 'melk', 'milk', 'kaas', 'cheese', 'yoghurt', 'yogurt', 'dair', 'eieren', 'egg', 'boter', 'butter'],
    'dranken': ['drank', 'cola', 'sap', 'juice', 'bier', 'beer', 'wijn', 'wine', 'water', 'koffie', 'coffee', 'thee', 'tea', 'beverage', 'drink', 'soda'],
    'brood-gebak': ['brood', 'bread', 'bakker', 'gebak', 'bakery', 'pastr'],
    'vlees-vis': ['vlees', 'meat', 'vis', 'fish', 'kip', 'chicken', 'worst', 'sausage', 'vega'],
    'fruit-groenten': ['fruit', 'groente', 'vegetable', 'aardappel', 'potato', 'salade', 'salad', 'peen', 'wortel', 'kool', 'appel', 'sla'],
    'graanproducten': ['pasta', 'rijst', 'rice', 'ontbijtgranen', 'cereal', 'muesli', 'noodle', 'meel', 'flour'],
    'snacks-snoep': ['snoep', 'candy', 'chips', 'koek', 'cookie', 'biscuit', 'chocola', 'snack', 'beleg', 'spread', 'jam', 'sweet'],
    'gereed-diepvries': ['diepvries', 'frozen', 'maaltijd', 'meal', 'pizza', 'soep', 'soup', 'ijs'],
    'ingredienten-kruiden': ['kruiden', 'spice', 'saus', 'sauce', 'olie', 'oil', 'conserven', 'canned', 'bakken', 'baking', 'suiker', 'sugar', 'azijn'],
    'huishouden': ['huishoud', 'household', 'schoonmaak', 'clean', 'wasmiddel', 'laundry', 'afwas', 'papier'],
    'verzorging-gezondheid': ['verzorging', 'drogist', 'care', 'hygi', 'shampoo', 'tand', 'health', 'baby'],
    'dierenvoeding': ['dier', 'huisdier', 'pet', 'kat', 'hond']
};

@Component({
    selector: 'app-new-item-form',
    standalone: true,
    imports: [FormsModule, TranslateModule, IconPickerComponent, ItemIconComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="flex items-center gap-3">
            <span class="h-12 w-12 shrink-0 rounded-xl p-1.5" style="background: var(--tile-neutral); color: var(--tile-text)">
                <app-item-icon [item]="preview()" />
            </span>
            <div class="grow">
                <label class="field-label !mt-0" for="new-item-name">{{ 'item.name' | translate }}</label>
                <input id="new-item-name" class="field" type="text" maxlength="80" [ngModel]="name()" (ngModelChange)="name.set($event)" />
            </div>
        </div>

        <label class="field-label" for="new-item-section">{{ 'item.section' | translate }}</label>
        <select id="new-item-section" class="field" [ngModel]="sectionId()" (ngModelChange)="sectionId.set($event)">
            @for (section of store.sections(); track section.id) {
                <option [value]="section.id">{{ section.emoji }} {{ section.name }}</option>
            }
        </select>

        <div class="flex items-end gap-3">
            <div class="grow">
                <span class="field-label">{{ 'item.icon' | translate }}</span>
                <button type="button" class="btn w-full !justify-start" (click)="pickingIcon.set(true)">
                    <i class="material-symbols-outlined">image</i>
                    {{ 'item.chooseIcon' | translate }}
                </button>
            </div>
            <div class="w-24">
                <label class="field-label" for="new-item-emoji">{{ 'item.emoji' | translate }}</label>
                <input id="new-item-emoji" class="field" type="text" maxlength="8" [ngModel]="emoji()" (ngModelChange)="emoji.set($event)" />
            </div>
        </div>

        <div class="mt-3 flex gap-2">
            <button type="button" class="btn" [disabled]="busy()" (click)="cancelled.emit()">
                <i class="material-symbols-outlined">close</i>
                {{ 'common.cancel' | translate }}
            </button>
            <button type="button" class="btn primary grow" [disabled]="busy() || !name().trim() || !sectionId()" (click)="create()">
                <i class="material-symbols-outlined">{{ submitIcon() }}</i>
                {{ submitLabel() }}
            </button>
        </div>

        @if (pickingIcon()) {
            <app-icon-picker [selected]="icon()" (picked)="chooseIcon($event)" (closed)="pickingIcon.set(false)" />
        }
    `
})
export class NewItemFormComponent {
    public readonly initialName = input.required<string>();
    public readonly hint = input('');
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
        const text = `${this.hint()} ${this.initialName()}`.toLowerCase();
        return Object.entries(SECTION_KEYWORDS).find(([, keywords]) => keywords.some((word) => text.includes(word)))?.[0];
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
