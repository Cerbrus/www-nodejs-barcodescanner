import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { ItemIconComponent } from '../../components/item-icon/item-icon.component';
import { Recipe } from '../../models';
import { ShoppingStore } from '../../services/shopping.store';

const SHOWN_ICONS = 5;

@Component({
    selector: 'app-recipes-page',
    standalone: true,
    imports: [FormsModule, RouterLink, TranslatePipe, ItemIconComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './recipes.page.html',
    styleUrl: './recipes.page.scss'
})
export class RecipesPage {
    protected readonly store = inject(ShoppingStore);
    protected readonly search = signal('');

    protected readonly rows = computed(() => {
        const term = this.search().trim().toLowerCase();

        return this.store
            .recipes()
            .filter((recipe) => recipe.name.toLowerCase().includes(term))
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((recipe) => ({
                recipe,
                icons: recipe.ingredients
                    .flatMap(({ catalogItemId }) => this.store.itemById(catalogItemId) ?? [])
                    .slice(0, SHOWN_ICONS)
            }));
    });

    protected add(recipe: Recipe): void {
        this.store
            .putRecipeOnList({
                name: recipe.name,
                ingredients: recipe.ingredients.map(({ catalogItemId, quantity, note }) => ({
                    catalogItemId,
                    quantity,
                    note
                }))
            })
            .subscribe();
    }
}
