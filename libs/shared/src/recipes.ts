export interface RecipeIngredient {
    catalogItemId: number;
    quantity: number;
    note: string;
    text?: string;
}

export interface RecipeContent {
    name: string;
    ingredients: Array<RecipeIngredient>;
}

export const RECIPE_CATEGORIES = [
    'breakfast',
    'lunch',
    'dinner',
    'soup',
    'salad',
    'dessert',
    'baking',
    'snack',
    'other'
] as const;

export type RecipeCategory = (typeof RECIPE_CATEGORIES)[number];

export const DEFAULT_RECIPE_CATEGORY: RecipeCategory = 'other';

export const recipeCategoryOf = (value: unknown): RecipeCategory =>
    RECIPE_CATEGORIES.find((category) => category === value) ?? DEFAULT_RECIPE_CATEGORY;

export const MAX_RECIPE_NAME_LENGTH = 80;
export const MAX_RECIPE_DESCRIPTION_LENGTH = 10000;
export const MAX_RECIPE_INGREDIENTS = 60;
export const MAX_RECIPE_SOURCE_LENGTH = 20000;
export const MAX_RECIPE_SOURCE_URL_LENGTH = 2000;
export const RECIPE_SOURCE_URL = /^(https?:\/\/\S+)?$/i;
export const MAX_RECIPE_PICTURE_BYTES = 10 * 1024 * 1024;
export const RECIPE_PICTURE_SIZES = ['small', 'large'] as const;

export type RecipePictureSize = (typeof RECIPE_PICTURE_SIZES)[number];

export const MAX_INGREDIENT_QUANTITY = 99;
export const MAX_INGREDIENT_NOTE_LENGTH = 200;
export const MAX_INGREDIENT_TEXT_LENGTH = 200;

const TEXT_JOINT = '; ';

export function cleanIngredients(ingredients: Array<RecipeIngredient>): Array<RecipeIngredient> {
    const merged = new Map<string, RecipeIngredient>();
    for (const { catalogItemId, quantity, note, text } of ingredients) {
        const variant = { catalogItemId, note: note.trim() };
        const key = `${variant.catalogItemId}:${variant.note}`;
        const earlier = merged.get(key);
        const texts = [earlier?.text, text?.trim()]
            .filter((part) => part)
            .join(TEXT_JOINT)
            .slice(0, MAX_INGREDIENT_TEXT_LENGTH);
        merged.set(key, {
            ...variant,
            quantity: Math.min((earlier?.quantity ?? 0) + quantity, MAX_INGREDIENT_QUANTITY),
            ...(texts ? { text: texts } : {})
        });
    }

    return [...merged.values()];
}
