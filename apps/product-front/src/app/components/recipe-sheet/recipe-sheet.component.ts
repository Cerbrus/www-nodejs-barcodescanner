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
import { TranslatePipe } from '@ngx-translate/core';

import { RecipeIngredient } from '@barcodescanner/shared';

import { ShoppingStore } from '../../services/shopping.store';
import { ItemIconComponent } from '../item-icon/item-icon.component';
import { SheetComponent } from '../sheet/sheet.component';

export interface RecipeChoice {
    ingredients: Array<RecipeIngredient>;
    save: boolean;
}

@Component({
    selector: 'app-recipe-sheet',
    standalone: true,
    imports: [TranslatePipe, ItemIconComponent, SheetComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './recipe-sheet.component.html',
    styleUrl: './recipe-sheet.component.scss'
})
export class RecipeSheetComponent {
    public readonly name = input.required<string>();
    public readonly ingredients = input.required<Array<RecipeIngredient>>();

    public readonly savable = input(false);

    public readonly confirmed = output<RecipeChoice>();
    public readonly closed = output<void>();

    protected readonly save = signal(false);
    protected readonly rows = computed(() =>
        this.ingredients().map((ingredient, index) => ({
            index,
            ingredient,
            item: this.store.itemById(ingredient.catalogItemId)
        }))
    );

    protected readonly unticked = linkedSignal<ReadonlySet<number>>(
        () =>
            new Set(
                this.rows()
                    .filter((row) => row.item?.stocked)
                    .map((row) => row.index)
            )
    );

    protected readonly chosen = computed(() =>
        this.rows()
            .filter((row) => row.item && !row.item.draft && !this.unticked().has(row.index))
            .map((row) => row.ingredient)
    );

    private readonly store = inject(ShoppingStore);

    protected toggle(index: number): void {
        this.unticked.update((unticked) => {
            const next = new Set(unticked);
            if (!next.delete(index)) {
                next.add(index);
            }

            return next;
        });
    }
}
