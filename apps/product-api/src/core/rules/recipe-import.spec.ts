import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { freeName, holdsLink, importPrompt, pagePrompt, readImport, readPage } from './recipe-import';

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

    it('keeps a known product, and a new one with a checked section and icon', () => {
        const read = readImport(
            {
                found: true,
                name: '  Zalmwraps ',
                description: ' 1. Rol op. ',
                ingredients: [
                    row({ productId: 2, quantity: 3, note: ' Fijn ' }),
                    row({ newName: 'zalmflakes', sectionId: 'zuivel', icon: 'vis', emoji: '🐟', note: '150g' }),
                    row({ newName: 'Veldsla', sectionId: 'nergens', icon: 'sla' })
                ]
            },
            CHOICES
        );

        assert.deepEqual(read, {
            name: 'Zalmwraps',
            description: '1. Rol op.',
            rows: [
                { catalogItemId: 2, quantity: 3, note: 'Fijn' },
                {
                    product: { name: 'Zalmflakes', sectionId: 'zuivel', icon: 'vis', emoji: '🐟' },
                    quantity: 1,
                    note: '150g'
                },
                {
                    product: { name: 'Veldsla', sectionId: 'eigen-items', icon: undefined, emoji: undefined },
                    quantity: 1,
                    note: ''
                }
            ]
        });
    });

    it('takes the existing product for a new name that exists, bounds quantities and drops what it cannot place', () => {
        const read = readImport(
            {
                found: true,
                name: 'Soep',
                description: '',
                ingredients: [
                    row({ newName: 'melk', quantity: 500 }),
                    row({ productId: 1, quantity: 0 }),
                    row({ productId: 1, quantity: 1.5 }),
                    row({ productId: 99 }),
                    undefined
                ]
            },
            CHOICES
        );

        assert.deepEqual(read?.rows, [
            { catalogItemId: 1, quantity: 99, note: '' },
            { catalogItemId: 1, quantity: 1, note: '' },
            { catalogItemId: 1, quantity: 1, note: '' }
        ]);
    });

    it('reads nothing from an answer without a recipe', () => {
        const ingredients = [row({ productId: 1 })];

        assert.equal(readImport({ found: false, name: 'Soep', description: '', ingredients }, CHOICES), undefined);
        assert.equal(readImport({ found: true, name: ' ', description: '', ingredients }, CHOICES), undefined);
        assert.equal(readImport({ found: true, name: 'Soep', description: '', ingredients: [] }, CHOICES), undefined);
        assert.equal(readImport({ found: true, name: 'Soep', description: '' }, CHOICES), undefined);
        assert.equal(readImport(undefined, CHOICES), undefined);
        assert.equal(readImport('Soep', CHOICES), undefined);
    });

    it('numbers a recipe name that is taken', () => {
        assert.equal(freeName('Soep', ['Taart']), 'Soep');
        assert.equal(freeName('Soep', ['soep']), 'Soep (2)');
        assert.equal(freeName('Soep', ['Soep', 'Soep (2)']), 'Soep (3)');
        assert.equal(freeName('a'.repeat(80), ['a'.repeat(80)]).length, 80);
    });
});
