export interface RecipeIngredient {
    catalogItemId: number;
    quantity: number;
    note: string;
}

export interface RecipeContent {
    name: string;
    ingredients: Array<RecipeIngredient>;
}

export const MAX_RECIPE_NAME_LENGTH = 80;
export const MAX_RECIPE_DESCRIPTION_LENGTH = 10000;
export const MAX_RECIPE_INGREDIENTS = 60;
export const MAX_RECIPE_SOURCE_LENGTH = 20000;
export const MAX_INGREDIENT_QUANTITY = 99;
export const MAX_INGREDIENT_NOTE_LENGTH = 200;

export function cleanIngredients(ingredients: Array<RecipeIngredient>): Array<RecipeIngredient> {
    const merged = new Map<string, RecipeIngredient>();
    for (const { catalogItemId, quantity, note } of ingredients) {
        const variant = { catalogItemId, note: note.trim() };
        const key = `${variant.catalogItemId}:${variant.note}`;
        const total = (merged.get(key)?.quantity ?? 0) + quantity;
        merged.set(key, { ...variant, quantity: Math.min(total, MAX_INGREDIENT_QUANTITY) });
    }

    return [...merged.values()];
}
