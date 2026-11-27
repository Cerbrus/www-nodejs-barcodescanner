import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { catchError, finalize, map, of, tap } from 'rxjs';

import { MAX_RECIPE_SOURCE_LENGTH, RECIPE_CATEGORIES, RecipeCategory, recipeCategoryOf } from '@barcodescanner/shared';

import { SheetComponent } from '../../components/sheet/sheet.component';
import { Recipe } from '../../models';
import { RECIPE_CATEGORY_ICONS } from '../../recipe-categories';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { RecipePrintService } from '../../services/recipe-print.service';
import { ShoppingStore } from '../../services/shopping.store';

@Component({
    selector: 'app-recipes-page',
    standalone: true,
    imports: [FormsModule, NgTemplateOutlet, RouterLink, TranslatePipe, SheetComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './recipes.page.html',
    styleUrl: './recipes.page.scss'
})
export class RecipesPage {
    protected readonly store = inject(ShoppingStore);
    private readonly printing = inject(RecipePrintService);
    private readonly router = inject(Router);
    private readonly api = inject(ApiService);

    protected readonly search = signal('');
    protected readonly selecting = signal(false);
    protected readonly selected = signal<ReadonlySet<number>>(new Set());
    protected readonly sourceLimit = MAX_RECIPE_SOURCE_LENGTH;
    protected readonly importing = signal(false);
    protected readonly busy = signal(false);
    protected readonly source = signal('');

    protected readonly failedPictures = signal<ReadonlySet<number>>(new Set());
    protected readonly category = signal<RecipeCategory | undefined>(undefined);
    protected readonly categoryIcons = RECIPE_CATEGORY_ICONS;

    protected readonly usedCategories = computed(() => {
        const used = new Set(this.store.recipes().map(({ category }) => recipeCategoryOf(category)));

        return RECIPE_CATEGORIES.filter((category) => used.has(category));
    });

    protected readonly shownCategory = computed(() =>
        this.usedCategories().find((category) => category === this.category())
    );

    protected readonly groups = computed(() => {
        const term = this.search().trim().toLowerCase();
        const only = this.shownCategory();
        const failed = this.failedPictures();
        const rows = this.store
            .recipes()
            .filter((recipe) => recipe.name.toLowerCase().includes(term))
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((recipe) => ({
                recipe,
                category: recipeCategoryOf(recipe.category),
                categoryIcon: RECIPE_CATEGORY_ICONS[recipeCategoryOf(recipe.category)],
                printable: !this.store.holdsDraft(recipe),
                picture: failed.has(recipe.id) ? undefined : this.api.recipePictureUrl(recipe, 'small'),
                icons: recipe.ingredients
                    .flatMap(({ catalogItemId }) => this.store.itemById(catalogItemId) ?? [])
                    .map(({ id, name, icon, emoji }) => ({
                        id,
                        mask: icon ? `url("${this.api.iconsUrl}/${encodeURIComponent(icon)}.png")` : undefined,
                        sign: emoji || name.charAt(0).toUpperCase()
                    }))
            }));

        return RECIPE_CATEGORIES.filter((category) => !only || category === only)
            .map((category) => ({ category, rows: rows.filter((row) => row.category === category) }))
            .filter(({ rows: inCategory }) => inCategory.length);
    });

    protected readonly importable = toSignal(
        inject(AuthService).owner()
            ? this.api.getRecipeImport().pipe(
                  map(({ available }) => available),
                  catchError(() => of(false))
              )
            : of(false),
        { initialValue: false }
    );

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

    protected pictureFailed(recipeId: number): void {
        this.failedPictures.update((failed) => new Set(failed).add(recipeId));
    }

    protected choose(category: RecipeCategory): void {
        this.category.set(category === this.shownCategory() ? undefined : category);
    }

    protected closeImport(): void {
        if (!this.busy()) {
            this.importing.set(false);
        }
    }

    protected importRecipe(): void {
        this.busy.set(true);
        this.store
            .importRecipe(this.source().trim())
            .pipe(
                tap((recipe) => {
                    this.importing.set(false);
                    this.source.set('');
                    void this.router.navigate(['/recipes', recipe.id]);
                }),
                catchError(() => of(undefined)),
                finalize(() => this.busy.set(false))
            )
            .subscribe();
    }

    protected toggle(recipeId: number): void {
        this.selected.update((selected) => {
            const next = new Set(selected);
            if (!next.delete(recipeId)) {
                next.add(recipeId);
            }

            return next;
        });
    }

    protected stopSelecting(): void {
        this.selecting.set(false);
        this.selected.set(new Set());
    }

    protected print(): void {
        this.printing.print(
            this.store
                .recipes()
                .filter((recipe) => this.selected().has(recipe.id) && !this.store.holdsDraft(recipe))
                .sort((a, b) => a.name.localeCompare(b.name))
        );
    }
}
