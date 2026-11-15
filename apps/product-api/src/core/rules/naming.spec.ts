import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { cleanTitle, proposeFromShops, proposeName } from './naming';

const PRODUCTS = [
    'Kaas',
    'Geraspte kaas',
    'Blauwe kaas',
    'Melk',
    'Soja melk',
    'Poedersuiker',
    'Suiker',
    'Pasta',
    'Tandpasta'
].map((name, index) => ({ id: index + 1, name }));
const idOf = (name: string): number | undefined => PRODUCTS.find((product) => product.name === name)?.id;

describe('naming rules', () => {
    it('drops the brand, the shop name and amounts from the title', () => {
        assert.deepEqual(cleanTitle({ title: 'Van Gilse Poedersuiker 250 g', brand: 'Van Gilse' }), ['Poedersuiker']);
        assert.deepEqual(cleanTitle({ title: 'AH Jonge kaas 48+ plakken' }), ['Jonge', 'kaas', 'plakken']);
        assert.deepEqual(cleanTitle({ title: 'Jumbo Volkoren pasta 500 g' }), ['Volkoren', 'pasta']);
        assert.deepEqual(cleanTitle({ title: 'AH Biologisch Halfvolle melk 1,5 L', brand: 'AH' }), [
            'Halfvolle',
            'melk'
        ]);
        assert.deepEqual(cleanTitle({ title: 'Cola 6 x 330 ml', brand: 'Coca-Cola' }), ['Cola']);
    });

    it('takes the most specific existing product that the title names, without a note', () => {
        assert.deepEqual(proposeName({ title: 'AH Geraspte kaas' }, PRODUCTS), {
            catalogItemId: idOf('Geraspte kaas'),
            name: 'Geraspte kaas',
            note: ''
        });
        assert.deepEqual(proposeName({ title: 'Van Gilse Poedersuiker', brand: 'Van Gilse' }, PRODUCTS), {
            catalogItemId: idOf('Poedersuiker'),
            name: 'Poedersuiker',
            note: ''
        });
    });

    it('offers a generic product with the rest of the title as note', () => {
        assert.deepEqual(proposeName({ title: 'AH Jonge kaas 48+' }, PRODUCTS), {
            catalogItemId: idOf('Kaas'),
            name: 'Kaas',
            note: 'Jonge'
        });
        assert.deepEqual(proposeName({ title: 'De Zaanse Hoeve Halfvolle melk', brand: 'De Zaanse Hoeve' }, PRODUCTS), {
            catalogItemId: idOf('Melk'),
            name: 'Melk',
            note: 'Halfvolle'
        });
    });

    it('matches whole words only, so a compound word becomes a new name', () => {
        assert.deepEqual(proposeName({ title: 'Nutella Hazelnootpasta', brand: 'Nutella' }, PRODUCTS), {
            name: 'Hazelnootpasta',
            note: ''
        });
        assert.equal(proposeName({ title: 'Prodent Tandpasta', brand: 'Prodent' }, PRODUCTS)?.name, 'Tandpasta');
    });

    it('ignores accents and capitals when it compares', () => {
        assert.equal(proposeName({ title: 'CREME FRAICHE' }, [{ id: 9, name: 'Crème fraîche' }])?.catalogItemId, 9);
    });

    it('proposes a new name from the title when no product matches', () => {
        assert.deepEqual(proposeName({ title: 'Jumbo Rode linzen 400 g' }, PRODUCTS), {
            name: 'Rode linzen',
            note: ''
        });
        assert.equal(proposeName({ title: 'AH 500 g' }, PRODUCTS), undefined);
    });

    it('prefers the shop whose title names a product exactly, then one that names a product at all', () => {
        const shops = [{ title: 'Halfvolle melk' }, { title: 'Melk' }];
        assert.deepEqual(proposeFromShops(shops, PRODUCTS), { catalogItemId: idOf('Melk'), name: 'Melk', note: '' });
        assert.deepEqual(proposeFromShops([{ title: 'Rode linzen' }, { title: 'Jonge kaas' }], PRODUCTS)?.name, 'Kaas');
        assert.equal(proposeFromShops([], PRODUCTS), undefined);
    });
});
