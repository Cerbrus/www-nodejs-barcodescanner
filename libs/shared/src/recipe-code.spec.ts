import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isRecipeCode, readRecipeCode, writeRecipeCode } from './recipe-code';
import { DEFAULT_RECIPE_CATEGORY, RECIPE_CATEGORIES, cleanIngredients, recipeCategoryOf } from './recipes';

const PRINTABLE_ASCII = /^[\x20-\x7e]*$/;

describe('the recipe code', () => {
    it('writes the marker, the name and one part per ingredient', () => {
        const code = writeRecipeCode({
            name: 'Pasta pesto',
            ingredients: [
                { catalogItemId: 45, quantity: 2, note: 'volkoren' },
                { catalogItemId: 112, quantity: 2, note: '' },
                { catalogItemId: 87, quantity: 1, note: 'rood' },
                { catalogItemId: 9, quantity: 1, note: '' }
            ]
        });

        assert.equal(code, 'R1;Pasta pesto;45*2:volkoren;112*2;87:rood;9');
    });

    it('reads back what it wrote, whatever the name and the notes hold', () => {
        const recipe = {
            name: 'Crème brûlée; 100% € 🍮',
            ingredients: [
                { catalogItemId: 1, quantity: 3, note: 'één; twee: drie * vier' },
                { catalogItemId: 2, quantity: 1, note: 'regel\neen\ttab' },
                { catalogItemId: 3, quantity: 99, note: '' }
            ]
        };
        const code = writeRecipeCode(recipe);

        assert.match(code, PRINTABLE_ASCII);
        assert.equal(code.split(';').length, 5);
        assert.deepEqual(readRecipeCode(code), recipe);
    });

    it('reads a recipe without ingredients and skips an empty part', () => {
        assert.deepEqual(readRecipeCode('R1;Leeg'), { name: 'Leeg', ingredients: [] });
        assert.deepEqual(readRecipeCode('R1;Soep;;7;'), {
            name: 'Soep',
            ingredients: [{ catalogItemId: 7, quantity: 1, note: '' }]
        });
    });

    it('leaves out half of a broken character pair instead of failing', () => {
        assert.deepEqual(readRecipeCode(writeRecipeCode({ name: 'a\uD83Cb', ingredients: [] })), {
            name: 'ab',
            ingredients: []
        });
    });

    it('refuses what is not a recipe code of this version', () => {
        const refused = [
            '8710400335481',
            'R2;Later;45',
            'R1',
            'r1;Pasta;45',
            'R1;Pasta;vijf',
            'R1;Pasta;0',
            'R1;Pasta;45*0',
            'R1;Pasta;45*100',
            'R1;Pasta;45*2*3',
            'R1;Pasta;-4',
            'R1;Pasta;1234567890',
            'R1;Pas%ta;45',
            'R1;Pasta;45:%E0%A4%A'
        ];

        assert.deepEqual(
            refused.filter((code) => readRecipeCode(code)),
            []
        );
    });

    it('tells a recipe code from a barcode by its start', () => {
        assert.equal(isRecipeCode('R1;Pasta;45'), true);
        assert.equal(isRecipeCode('8710400335481'), false);
        assert.equal(isRecipeCode('R2;Pasta;45'), false);
    });
});

describe('the ingredients of a recipe', () => {
    it('trims notes and adds up the same product with the same note, in the order they came', () => {
        const cleaned = cleanIngredients([
            { catalogItemId: 4, quantity: 1, note: ' rood ' },
            { catalogItemId: 9, quantity: 2, note: '' },
            { catalogItemId: 4, quantity: 2, note: 'rood' },
            { catalogItemId: 4, quantity: 1, note: 'geel' }
        ]);

        assert.deepEqual(cleaned, [
            { catalogItemId: 4, quantity: 3, note: 'rood' },
            { catalogItemId: 9, quantity: 2, note: '' },
            { catalogItemId: 4, quantity: 1, note: 'geel' }
        ]);
    });

    it('keeps the ingredient lines of rows that become one, joined, and leaves a row without one as it is', () => {
        const cleaned = cleanIngredients([
            { catalogItemId: 4, quantity: 2, note: '', text: ' 2 eieren ' },
            { catalogItemId: 9, quantity: 1, note: '', text: '  ' },
            { catalogItemId: 4, quantity: 2, note: '', text: '2 eieren voor de vulling' },
            { catalogItemId: 4, quantity: 1, note: '' },
            { catalogItemId: 7, quantity: 1, note: '', text: 'a'.repeat(150) },
            { catalogItemId: 7, quantity: 1, note: '', text: 'b'.repeat(150) }
        ]);

        assert.deepEqual(cleaned.slice(0, 2), [
            { catalogItemId: 4, quantity: 5, note: '', text: '2 eieren; 2 eieren voor de vulling' },
            { catalogItemId: 9, quantity: 1, note: '' }
        ]);
        assert.equal(cleaned[2].text?.length, 200);
    });

    it('never counts past the highest quantity', () => {
        const [total] = cleanIngredients([
            { catalogItemId: 4, quantity: 60, note: '' },
            { catalogItemId: 4, quantity: 60, note: '' }
        ]);

        assert.equal(total.quantity, 99);
    });
});

describe('the category of a recipe', () => {
    it('is one of the fixed set that ends in other, and anything else reads as other', () => {
        assert.equal(RECIPE_CATEGORIES.length, 9);
        assert.equal(RECIPE_CATEGORIES.at(-1), DEFAULT_RECIPE_CATEGORY);
        assert.equal(recipeCategoryOf('baking'), 'baking');
        assert.equal(recipeCategoryOf('Baking'), 'other');
        assert.equal(recipeCategoryOf(undefined), 'other');
        assert.equal(recipeCategoryOf(3), 'other');
    });
});
