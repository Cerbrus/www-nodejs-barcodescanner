import { pictureAddress } from './picture-source';

const DATA_BLOCK = /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
const META_TAG = /<meta\b[^>]*>/gi;
const ATTRIBUTE = /([a-z:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
const TAG = /<[^>]+>/g;
const ENTITY = /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi;
const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const HEX = 16;
const MOST_NESTING = 6;

export interface RecipePage {
    text?: string;
    picture: string;
}

type Node = Record<string, unknown>;

const isNode = (value: unknown): value is Node => typeof value === 'object' && value !== null && !Array.isArray(value);
const listOf = (value: unknown): Array<unknown> => (Array.isArray(value) ? value : value === undefined ? [] : [value]);

function plain(value: unknown): string {
    if (typeof value !== 'string' && typeof value !== 'number') {
        return '';
    }

    return String(value)
        .replace(TAG, ' ')
        .replace(ENTITY, (whole, name: string) => {
            const code = name.startsWith('#x')
                ? parseInt(name.slice(2), HEX)
                : name.startsWith('#')
                  ? Number(name.slice(1))
                  : undefined;

            return code ? String.fromCodePoint(code) : (NAMED[name.toLowerCase()] ?? whole);
        })
        .replace(/\s+/g, ' ')
        .trim();
}

function recipeIn(value: unknown, depth = 0): Node | undefined {
    if (depth > MOST_NESTING) {
        return undefined;
    }
    if (Array.isArray(value)) {
        return value.map((part) => recipeIn(part, depth + 1)).find((found) => found);
    }
    if (!isNode(value)) {
        return undefined;
    }

    return listOf(value['@type']).includes('Recipe') ? value : recipeIn(value['@graph'], depth + 1);
}

function stepsOf(value: unknown, depth = 0): Array<string> {
    if (depth > MOST_NESTING) {
        return [];
    }

    return listOf(value).flatMap((step) => {
        if (!isNode(step)) {
            return plain(step) || [];
        }

        return step['itemListElement']
            ? stepsOf(step['itemListElement'], depth + 1)
            : plain(step['text'] ?? step['name']) || [];
    });
}

function addressOf(value: unknown, page: string): string {
    const [first] = listOf(value);
    const written = isNode(first) ? first['url'] : first;

    return typeof written === 'string' && URL.canParse(written.trim(), page)
        ? pictureAddress(new URL(plain(written), page).href)
        : '';
}

function previewPicture(html: string, page: string): string {
    for (const [tag] of html.matchAll(META_TAG)) {
        const attributes = Object.fromEntries(
            Array.from(tag.matchAll(ATTRIBUTE), ([, name, double, single]) => [name.toLowerCase(), double ?? single])
        );
        if ((attributes['property'] ?? attributes['name']) === 'og:image' && attributes['content']) {
            return addressOf(attributes['content'], page);
        }
    }

    return '';
}

function dataOf(html: string): Node | undefined {
    for (const [, block] of html.matchAll(DATA_BLOCK)) {
        try {
            const recipe = recipeIn(JSON.parse(block));
            if (recipe) {
                return recipe;
            }
        } catch {
            continue;
        }
    }

    return undefined;
}

export function readRecipePage(html: string, page: string): RecipePage {
    const recipe = dataOf(html);
    const name = plain(recipe?.['name']);
    const ingredients = listOf(recipe?.['recipeIngredient'])
        .map(plain)
        .filter((line) => line);
    const servings = plain(listOf(recipe?.['recipeYield'])[0]);
    const lines = [name, servings, ...ingredients, ...stepsOf(recipe?.['recipeInstructions'])].filter((line) => line);

    return {
        text: name && ingredients.length ? lines.join('\n') : undefined,
        picture: addressOf(recipe?.['image'], page) || previewPicture(html, page)
    };
}
