import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { freeName, holdsLink, importPrompt, pagePrompt, readImport, readPage, withSource } from './recipe-import';

const CHOICES = {
    products: [
        { id: 1, name: 'Melk' },
        { id: 2, name: 'Rode ui' }
    ],
    sections: [
        { id: 'zuivel', name: 'Zuivel' },
        { id: 'eigen-items', name: 'Eigen items' }
    ],
    icons: ['melk', 'vis']
};

const row = (change: object): object => ({
    line: '',
    productId: 0,
    newName: '',
    sectionId: '',
    icon: '',
    emoji: '',
    quantity: 1,
    note: '',
    ...change
});

describe('recipe import', () => {
    it('tells a link from pasted text and puts the choices in the question', () => {
        assert.equal(holdsLink('zie https://example.com/recept/1 graag'), true);
        assert.equal(holdsLink('500 g bloem, 2 eieren'), false);

        const prompt = importPrompt(' 500 g bloem ', CHOICES);
        assert.match(prompt, /The recipe is the text below/);
        assert.match(prompt, /<recipe>\n500 g bloem\n<\/recipe>/);
        assert.match(prompt, /2\tRode ui/);
        assert.match(prompt, /eigen-items\tEigen items/);
        assert.match(prompt, /melk, vis/);
    });

    it('asks for the page of a link apart, and takes its recipe only when the page was found', () => {
        assert.match(pagePrompt(' https://example.com/r '), /<link>\nhttps:\/\/example.com\/r\n<\/link>/);

        assert.equal(readPage({ found: true, recipe: ' Soep\n1 ui ' }), 'Soep\n1 ui');
        assert.equal(readPage({ found: false, recipe: 'Soep' }), undefined);
        assert.equal(readPage({ found: true, recipe: ' ' }), undefined);
        assert.equal(readPage({ found: true }), undefined);
        assert.equal(readPage(undefined), undefined);
    });

    it('keeps a picked product whose name is in the line, and a new one with a checked section and icon', () => {
        const read = readImport(
            {
                found: true,
                name: '  Zalmwraps ',
                description: ' 1. Rol op. ',
                ingredients: [
                    row({ line: ' 3 rode uien ', productId: 2, newName: 'Ui', quantity: 3, note: ' Fijn ' }),
                    row({
                        line: '150 g zalmflakes',
                        newName: 'zalmflakes',
                        sectionId: 'zuivel',
                        icon: 'vis',
                        emoji: '🐟',
                        note: '150g'
                    }),
                    row({ line: '75 g veldsla', newName: 'Veldsla', sectionId: 'nergens', icon: 'sla' })
                ]
            },
            CHOICES
        );

        assert.deepEqual(read, {
            name: 'Zalmwraps',
            description: '1. Rol op.',
            rows: [
                { catalogItemId: 2, quantity: 3, note: 'Fijn', text: '3 rode uien' },
                {
                    product: { name: 'Zalmflakes', sectionId: 'zuivel', icon: 'vis', emoji: '🐟' },
                    quantity: 1,
                    note: '150g',
                    text: '150 g zalmflakes'
                },
                {
                    product: { name: 'Veldsla', sectionId: 'eigen-items', icon: undefined, emoji: undefined },
                    quantity: 1,
                    note: '',
                    text: '75 g veldsla'
                }
            ]
        });
    });

    it('refuses a picked product whose name is not in the line, and makes the named product instead', () => {
        const rows = (ingredients: Array<object>): unknown =>
            readImport({ found: true, name: 'Schotel', description: '', ingredients }, CHOICES)?.rows;

        assert.deepEqual(
            rows([
                row({
                    line: '3 el milde harissa',
                    productId: 1,
                    newName: 'Harissa',
                    sectionId: 'zuivel',
                    note: 'Mild, 3el'
                }),
                row({ line: '250 g romaatjes', productId: 1, newName: 'Melk', note: 'Romaatjes, 250g' }),
                row({ line: '1 rode ui', productId: 1, newName: 'rode ui' }),
                row({ line: '200 ml volle melk', productId: 2, newName: 'Melk' }),
                row({ line: '2 tenen knoflook', productId: 1 }),
                row({ line: '', productId: 1 })
            ]),
            [
                {
                    product: { name: 'Harissa', sectionId: 'zuivel', icon: undefined, emoji: undefined },
                    quantity: 1,
                    note: 'Mild, 3el',
                    text: '3 el milde harissa'
                },
                {
                    product: { name: 'Romaatjes', sectionId: 'eigen-items', icon: undefined, emoji: undefined },
                    quantity: 1,
                    note: '250g',
                    text: '250 g romaatjes'
                },
                { catalogItemId: 2, quantity: 1, note: '', text: '1 rode ui' },
                { catalogItemId: 1, quantity: 1, note: '', text: '200 ml volle melk' },
                {
                    product: { name: 'Knoflook', sectionId: 'eigen-items', icon: undefined, emoji: undefined },
                    quantity: 1,
                    note: '',
                    text: '2 tenen knoflook'
                }
            ]
        );
    });

    it('takes the existing product for a new name that exists, bounds quantities and drops what it cannot place', () => {
        const read = readImport(
            {
                found: true,
                name: 'Soep',
                description: '',
                ingredients: [
                    row({ newName: 'melk', quantity: 500 }),
                    row({ line: 'melk', productId: 1, quantity: 0 }),
                    row({ line: 'melk', productId: 1, quantity: 1.5 }),
                    row({ productId: 99 }),
                    undefined
                ]
            },
            CHOICES
        );

        assert.deepEqual(read?.rows, [
            { catalogItemId: 1, quantity: 99, note: '', text: '' },
            { catalogItemId: 1, quantity: 1, note: '', text: 'melk' },
            { catalogItemId: 1, quantity: 1, note: '', text: 'melk' }
        ]);
    });

    it('reads nothing from an answer without a recipe', () => {
        const ingredients = [row({ line: '1 l melk', productId: 1 })];

        assert.equal(readImport({ found: false, name: 'Soep', description: '', ingredients }, CHOICES), undefined);
        assert.equal(readImport({ found: true, name: ' ', description: '', ingredients }, CHOICES), undefined);
        assert.equal(readImport({ found: true, name: 'Soep', description: '', ingredients: [] }, CHOICES), undefined);
        assert.equal(readImport({ found: true, name: 'Soep', description: '' }, CHOICES), undefined);
        assert.equal(readImport(undefined, CHOICES), undefined);
        assert.equal(readImport('Soep', CHOICES), undefined);
    });

    it('puts the link a recipe came from under its description, and leaves pasted text as it is', () => {
        assert.equal(
            withSource('1. Roer.', 'kijk: https://www.example.com/recept/soep_(oud).'),
            '1. Roer.\n\n[www.example.com](https://www.example.com/recept/soep_%28oud%29)'
        );
        assert.equal(withSource('', 'https://example.com/r'), '[example.com](https://example.com/r)');
        assert.equal(withSource('1. Roer.', '500 g bloem'), '1. Roer.');

        const long = withSource('a'.repeat(10000), 'https://example.com/r');
        assert.equal(long.length, 10000);
        assert.ok(long.endsWith('\n\n[example.com](https://example.com/r)'));
    });

    it('numbers a recipe name that is taken', () => {
        assert.equal(freeName('Soep', ['Taart']), 'Soep');
        assert.equal(freeName('Soep', ['soep']), 'Soep (2)');
        assert.equal(freeName('Soep', ['Soep', 'Soep (2)']), 'Soep (3)');
        assert.equal(freeName('a'.repeat(80), ['a'.repeat(80)]).length, 80);
    });
});
