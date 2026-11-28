import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import {
    ChangeDetectionStrategy,
    Component,
    booleanAttribute,
    computed,
    effect,
    inject,
    input,
    linkedSignal,
    numberAttribute,
    signal,
    untracked
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { catchError, finalize, map, merge, of, switchMap, tap } from 'rxjs';

import {
    MAX_INGREDIENT_NOTE_LENGTH,
    MAX_INGREDIENT_QUANTITY,
    MAX_INGREDIENT_TEXT_LENGTH,
    MAX_RECIPE_DESCRIPTION_LENGTH,
    MAX_RECIPE_INGREDIENTS,
    MAX_RECIPE_NAME_LENGTH,
    MAX_RECIPE_SOURCE_URL_LENGTH,
    RECIPE_CATEGORIES,
    RECIPE_SOURCE_URL,
    RecipeCategory,
    RecipeIngredient,
    recipeCategoryOf
} from '@barcodescanner/shared';

import { ItemAutocompleteComponent } from '../../components/item-autocomplete/item-autocomplete.component';
import { ItemIconComponent } from '../../components/item-icon/item-icon.component';
import { MarkdownComponent } from '../../components/markdown/markdown.component';
import { NewItemFormComponent } from '../../components/new-item-form/new-item-form.component';
import { PictureCutComponent } from '../../components/picture-cut/picture-cut.component';
import { RecipeCodeComponent } from '../../components/recipe-code/recipe-code.component';
import { RecipeSheetComponent } from '../../components/recipe-sheet/recipe-sheet.component';
import { SheetComponent } from '../../components/sheet/sheet.component';
import { FocusOnShowDirective } from '../../directives/focus-on-show.directive';
import { CatalogItem } from '../../models';
import { RECIPE_CATEGORY_ICONS } from '../../recipe-categories';
import { ApiService } from '../../services/api.service';
import { RecipePrintService } from '../../services/recipe-print.service';
import { ShoppingStore } from '../../services/shopping.store';
import { ToastService } from '../../services/toast.service';

const CHARACTERS_ON_A_LINE = 36;
const FEWEST_DESCRIPTION_ROWS = 4;
const MOST_DESCRIPTION_ROWS = 24;

const plain = ({ catalogItemId, quantity, note }: RecipeIngredient): RecipeIngredient => ({
    catalogItemId,
    quantity,
    note
});

const written = (ingredient: RecipeIngredient): RecipeIngredient => ({
    ...plain(ingredient),
    text: ingredient.text?.trim() ?? ''
});

@Component({
    selector: 'app-recipe-page',
    standalone: true,
    imports: [
        CdkDrag,
        CdkDropList,
        FormsModule,
        RouterLink,
        TranslatePipe,
        ItemAutocompleteComponent,
        ItemIconComponent,
        MarkdownComponent,
        NewItemFormComponent,
        PictureCutComponent,
        RecipeCodeComponent,
        RecipeSheetComponent,
        SheetComponent,
        FocusOnShowDirective
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './recipe.page.html',
    styleUrl: './recipe.page.scss'
})
export class RecipePage {
    public readonly id = input(undefined, {
        transform: (value: unknown) => (value === undefined ? undefined : numberAttribute(value))
    });

    public readonly edit = input(false, { transform: booleanAttribute });

    protected readonly store = inject(ShoppingStore);
    protected readonly printing = inject(RecipePrintService);
    protected readonly limits = {
        name: MAX_RECIPE_NAME_LENGTH,
        description: MAX_RECIPE_DESCRIPTION_LENGTH,
        note: MAX_INGREDIENT_NOTE_LENGTH,
        text: MAX_INGREDIENT_TEXT_LENGTH,
        quantity: MAX_INGREDIENT_QUANTITY,
        ingredients: MAX_RECIPE_INGREDIENTS,
        sourceUrl: MAX_RECIPE_SOURCE_URL_LENGTH
    };

    protected readonly dragDelay = { touch: 250, mouse: 0 };
    protected readonly editing = signal(false);
    protected readonly adding = signal(false);
    protected readonly confirmingDelete = signal(false);
    protected readonly name = signal('');
    protected readonly description = signal('');
    protected readonly category = signal<RecipeCategory | ''>('');
    protected readonly sourceUrl = signal('');
    protected readonly categories = RECIPE_CATEGORIES;
    protected readonly categoryIcons = RECIPE_CATEGORY_ICONS;
    protected readonly ingredients = signal<Array<RecipeIngredient>>([]);
    protected readonly search = signal('');
    protected readonly creatingName = signal<string | undefined>(undefined);
    protected readonly pictureChoice = signal<Blob | undefined>(undefined);
    protected readonly newPicture = signal<Blob | undefined>(undefined);
    protected readonly newPictureAddress = signal<string | undefined>(undefined);
    protected readonly pictureRemoved = signal(false);
    protected readonly pictureLink = signal('');
    protected readonly fetchingPicture = signal(false);

    protected readonly descriptionRows = computed(() => {
        const lines = this.description()
            .split('\n')
            .reduce((total, line) => total + Math.max(1, Math.ceil(line.length / CHARACTERS_ON_A_LINE)), 0);

        return Math.min(MOST_DESCRIPTION_ROWS, Math.max(FEWEST_DESCRIPTION_ROWS, lines + 1));
    });

    protected readonly recipe = computed(() => {
        const id = this.id();

        return id === undefined ? undefined : this.store.recipeById(id);
    });

    protected readonly shownCategory = computed(() => recipeCategoryOf(this.recipe()?.category));
    protected readonly pictureFailed = linkedSignal({ source: () => this.recipe()?.picture, computation: () => false });
    protected readonly picture = computed(() => {
        const recipe = this.recipe();

        return recipe && !this.pictureFailed() ? this.api.recipePictureUrl(recipe, 'large') : undefined;
    });

    protected readonly editPicture = computed(() => {
        const recipe = this.recipe();
        if (this.pictureRemoved()) {
            return undefined;
        }

        return this.newPictureAddress() ?? (recipe ? this.api.recipePictureUrl(recipe, 'small') : undefined);
    });

    protected readonly source = computed(() => {
        const url = this.recipe()?.sourceUrl;

        return url && RECIPE_SOURCE_URL.test(url)
            ? { url, host: URL.canParse(url) ? new URL(url).hostname : url }
            : undefined;
    });

    protected readonly holdsDraft = computed(() => {
        const recipe = this.recipe();

        return recipe !== undefined && this.store.holdsDraft(recipe);
    });

    protected readonly shown = computed(() => {
        this.language();

        return (this.editing() ? this.ingredients() : (this.recipe()?.ingredients ?? [])).map((ingredient) => {
            const item = this.store.itemById(ingredient.catalogItemId);
            const name =
                item?.name ?? this.translate.instant('recipe.unknownProduct', { id: ingredient.catalogItemId });
            const described = [name, ingredient.note].filter((part) => part).join(', ');

            return {
                ingredient,
                item,
                fallback: ingredient.quantity > 1 ? `${described} ×${ingredient.quantity}` : described
            };
        });
    });

    protected readonly canSave = computed(() => {
        const recipe = this.recipe();
        const changed =
            !recipe ||
            this.name().trim() !== recipe.name ||
            this.description().trim() !== recipe.description ||
            this.category() !== this.shownCategory() ||
            this.sourceUrl().trim() !== (recipe.sourceUrl ?? '') ||
            JSON.stringify(this.ingredients().map(written)) !== JSON.stringify(recipe.ingredients.map(written)) ||
            this.pictureChange() !== undefined;

        return (
            this.name().trim().length > 0 &&
            this.category() !== '' &&
            RECIPE_SOURCE_URL.test(this.sourceUrl().trim()) &&
            changed
        );
    });

    private readonly pictureChange = computed(() => {
        const removed = this.pictureRemoved() && this.recipe()?.picture ? null : undefined;

        return this.newPicture() ?? removed;
    });

    private readonly router = inject(Router);
    private readonly api = inject(ApiService);
    private openedForEdit = false;
    private readonly toasts = inject(ToastService);
    private readonly translate = inject(TranslateService);
    private readonly language = toSignal(merge(this.translate.onLangChange, this.translate.onTranslationChange));

    constructor() {
        effect((onCleanup) => {
            const picture = this.newPicture();
            const address = picture ? URL.createObjectURL(picture) : undefined;
            this.newPictureAddress.set(address);
            if (address) {
                onCleanup(() => URL.revokeObjectURL(address));
            }
        });
        effect(() => {
            if (this.id() === undefined) {
                untracked(() => this.startEdit());
            }
        });
        effect(() => {
            if (this.edit() && this.recipe() && !this.openedForEdit) {
                this.openedForEdit = true;
                untracked(() => this.startEdit());
            }
        });
    }

    protected startEdit(): void {
        const recipe = this.recipe();
        this.name.set(recipe?.name ?? '');
        this.description.set(recipe?.description ?? '');
        this.category.set(recipe ? this.shownCategory() : '');
        this.sourceUrl.set(recipe?.sourceUrl ?? '');
        this.ingredients.set(recipe?.ingredients.map(written) ?? []);
        this.search.set('');
        this.pictureChoice.set(undefined);
        this.newPicture.set(undefined);
        this.pictureRemoved.set(false);
        this.pictureLink.set('');
        this.confirmingDelete.set(false);
        this.editing.set(true);
    }

    protected cancel(): void {
        if (this.id() === undefined) {
            void this.router.navigate(['/recipes']);
        } else {
            this.editing.set(false);
        }
    }

    protected save(): void {
        const isNew = this.id() === undefined;
        const category = this.category();
        const picture = this.pictureChange();
        if (!category) {
            return;
        }

        this.store
            .saveRecipe(this.id(), {
                name: this.name().trim(),
                description: this.description().trim(),
                category,
                sourceUrl: this.sourceUrl().trim(),
                ingredients: this.ingredients().map(written)
            })
            .pipe(
                switchMap((saved) =>
                    picture === undefined
                        ? of(saved)
                        : this.store.changeRecipePicture(saved.id, picture).pipe(map(() => saved))
                ),
                tap((saved) => {
                    this.toasts.show({ kind: 'ok', text: this.translate.instant('recipe.saved') });
                    this.editing.set(false);
                    if (isNew) {
                        void this.router.navigate(['/recipes', saved.id], { replaceUrl: true });
                    }
                })
            )
            .subscribe();
    }

    protected choosePicture(field: HTMLInputElement): void {
        const file = field.files?.[0];
        field.value = '';
        if (file) {
            this.pictureChoice.set(file);
        }
    }

    protected fetchPicture(): void {
        this.fetchingPicture.set(true);
        this.api
            .fetchPicture(this.pictureLink().trim())
            .pipe(
                tap((picture) => {
                    this.pictureLink.set('');
                    this.pictureChoice.set(picture);
                }),
                catchError(() => of(undefined)),
                finalize(() => this.fetchingPicture.set(false))
            )
            .subscribe();
    }

    protected usePicture(picture: Blob): void {
        this.newPicture.set(picture);
        this.pictureRemoved.set(false);
        this.pictureChoice.set(undefined);
    }

    protected removePicture(): void {
        this.newPicture.set(undefined);
        this.pictureRemoved.set(true);
    }

    protected delete(): void {
        const id = this.id();
        if (id === undefined) {
            return;
        }

        this.store
            .deleteRecipe(id)
            .pipe(tap(() => void this.router.navigate(['/recipes'])))
            .subscribe();
    }

    protected addIngredient(item: CatalogItem): void {
        this.search.set('');
        this.creatingName.set(undefined);
        const index = this.ingredients().findIndex((row) => row.catalogItemId === item.id && !row.note);
        if (index < 0) {
            this.ingredients.update((rows) => [...rows, { catalogItemId: item.id, quantity: 1, note: '', text: '' }]);
        } else {
            this.changeQuantity(index, 1);
        }
    }

    protected changeQuantity(index: number, delta: number): void {
        this.change(index, (row) => ({
            ...row,
            quantity: Math.min(MAX_INGREDIENT_QUANTITY, Math.max(1, row.quantity + delta))
        }));
    }

    protected setNote(index: number, note: string): void {
        this.change(index, (row) => ({ ...row, note: note.trim() }));
    }

    protected setText(index: number, text: string): void {
        this.change(index, (row) => ({ ...row, text }));
    }

    protected moveIngredient({ previousIndex, currentIndex }: CdkDragDrop<unknown>): void {
        this.ingredients.update((rows) => {
            const moved = [...rows];
            moveItemInArray(moved, previousIndex, currentIndex);

            return moved;
        });
    }

    protected removeIngredient(index: number): void {
        this.ingredients.update((rows) => rows.filter((_, position) => position !== index));
    }

    protected putOnList(ingredients: Array<RecipeIngredient>): void {
        const recipe = this.recipe();
        if (!recipe) {
            return;
        }

        this.adding.set(false);
        this.store.putRecipeOnList({ name: recipe.name, ingredients: ingredients.map(plain) }).subscribe();
    }

    private change(index: number, change: (row: RecipeIngredient) => RecipeIngredient): void {
        this.ingredients.update((rows) => rows.map((row, position) => (position === index ? change(row) : row)));
    }
}
