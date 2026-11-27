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

export const MAX_RECIPE_NAME_LENGTH = 80;
export const MAX_RECIPE_DESCRIPTION_LENGTH = 10000;
export const MAX_RECIPE_INGREDIENTS = 60;
export const MAX_RECIPE_SOURCE_LENGTH = 20000;
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
