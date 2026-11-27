import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    IMPORT_SCHEMA,
    freeName,
    holdsLink,
    importPrompt,
    linkIn,
    pagePrompt,
    readImport,
    readPage,
    readPagePicture
} from './recipe-import';

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

    it('asks for the picture of the page, and takes only an https address of a page that was found', () => {
        assert.match(pagePrompt('https://example.com/r'), /- picture: the full address of the main picture/);

        const picture = 'https://static.example.com/soep.jpg';
        assert.equal(readPagePicture({ found: true, recipe: 'Soep', picture }), picture);
        assert.equal(readPagePicture({ found: false, recipe: '', picture }), '');
        assert.equal(
            readPagePicture({ found: true, recipe: 'Soep', picture: 'http://static.example.com/soep.jpg' }),
            ''
        );
        assert.equal(readPagePicture({ found: true, recipe: 'Soep', picture: '' }), '');
        assert.equal(readPagePicture({ found: true, recipe: 'Soep' }), '');
        assert.equal(readPagePicture(undefined), '');
    });

    it('keeps a picked product whose name is in the line, and a new one with a checked section and icon', () => {
        const read = readImport(
            {
                found: true,
                name: '  Zalmwraps ',
                description: ' 1. Rol op. ',
                category: 'lunch',
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
            category: 'lunch',
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

    it('asks for one of the fixed categories, and files an answer outside them under other', () => {
        const category = (answered?: unknown): unknown =>
            readImport(
                {
                    found: true,
                    name: 'Soep',
                    description: '',
                    category: answered,
                    ingredients: [row({ line: '1 l melk', productId: 1 })]
                },
                CHOICES
            )?.category;

        assert.match(importPrompt('soep', CHOICES), /CATEGORIES\nbreakfast, lunch, dinner, soup, .*other\n/);
        assert.deepEqual(IMPORT_SCHEMA.properties.category.enum.slice(0, 3), ['breakfast', 'lunch', 'dinner']);
        assert.ok(IMPORT_SCHEMA.required.includes('category'));
        assert.equal(category('soup'), 'soup');
        assert.equal(category('Soup'), 'other');
        assert.equal(category('stamppot'), 'other');
        assert.equal(category(7), 'other');
        assert.equal(category(), 'other');
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

    it('takes the link a recipe came from out of what was pasted, and none out of plain text', () => {
        assert.equal(
            linkIn('kijk: https://www.example.com/recept/soep_(oud).'),
            'https://www.example.com/recept/soep_(oud)'
        );
        assert.equal(linkIn('(https://example.com/r)'), 'https://example.com/r');
        assert.equal(linkIn('500 g bloem'), '');
        assert.equal(linkIn(`https://example.com/${'a'.repeat(2000)}`), '');
    });

    it('numbers a recipe name that is taken', () => {
        assert.equal(freeName('Soep', ['Taart']), 'Soep');
        assert.equal(freeName('Soep', ['soep']), 'Soep (2)');
        assert.equal(freeName('Soep', ['Soep', 'Soep (2)']), 'Soep (3)');
        assert.equal(freeName('a'.repeat(80), ['a'.repeat(80)]).length, 80);
    });
});
