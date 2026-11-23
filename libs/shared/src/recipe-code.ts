import { MAX_INGREDIENT_QUANTITY, RecipeContent, RecipeIngredient } from './recipes';

const MARKER = 'R1';
const SEPARATOR = ';';
const INGREDIENT = /^([1-9]\d{0,8})(?:\*([1-9]\d{0,2}))?(?::(.*))?$/s;

function escapeText(text: string): string {
    return text
        .replace(/[\uD800-\uDFFF]/gu, '')
        .replace(/[;%]|[^\x20-\x7e]/gu, (character) => encodeURIComponent(character));
}

function readIngredient(part: string): RecipeIngredient | undefined {
    const [, id, quantity, note] = INGREDIENT.exec(part) ?? [];
    if (!id || Number(quantity ?? 1) > MAX_INGREDIENT_QUANTITY) {
        return undefined;
    }

    return { catalogItemId: Number(id), quantity: Number(quantity ?? 1), note: decodeURIComponent(note ?? '') };
}

export function isRecipeCode(text: string): boolean {
    return text.startsWith(`${MARKER}${SEPARATOR}`);
}

export function writeRecipeCode({ name, ingredients }: RecipeContent): string {
    const parts = ingredients.map(
        ({ catalogItemId, quantity, note }) =>
            `${catalogItemId}${quantity > 1 ? `*${quantity}` : ''}${note ? `:${escapeText(note)}` : ''}`
    );

    return [MARKER, escapeText(name), ...parts].join(SEPARATOR);
}

export function readRecipeCode(code: string): RecipeContent | undefined {
    const [marker, name, ...parts] = code.split(SEPARATOR);
    if (marker !== MARKER || name === undefined) {
        return undefined;
    }

    try {
        const ingredients = parts.filter((part) => part).map(readIngredient);

        return ingredients.every((ingredient) => ingredient !== undefined)
            ? { name: decodeURIComponent(name), ingredients }
            : undefined;
    } catch {
        return undefined;
    }
}
