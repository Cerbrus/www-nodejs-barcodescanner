import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fits, mostSpecific, stem } from './product-match';

const FITTING: Array<[string, string]> = [
    ['308 g Oreo-koekjes', 'Koekjes'],
    ['180 g ongezouten roomboter', 'Boter'],
    ['3 el bourbon whisky', 'Whisky'],
    ['2 middelgrote scharreleieren', 'Eieren'],
    ['1 ei', 'Eieren'],
    ['1 rode ui', 'Uien'],
    ['2 bosuien', 'Uien'],
    ['2 el rodewijnazijn', 'Azijn'],
    ['4 tortillawraps', 'Tortillas'],
    ['150 g warmgerookte zalmflakes', 'Zalm'],
    ['165 g groene olijven met knoflook', 'Olijven'],
    ['1 olijf', 'Olijven'],
    ['1 tomaat', 'Tomaten'],
    ['1 banaan', 'Bananen'],
    ['1 peer', 'Peren'],
    ['100 g kaas', 'Kaas'],
    ['2 soorten kazen', 'Kaas'],
    ['1 zoete aardappel', 'Zoete aardappelen'],
    ['1 koekje', 'Koekjes'],
    ['1 stuk groente', 'Groenten'],
    ['2 el creme fraiche', 'Crème fraîche']
];

const NOT_FITTING: Array<[string, string]> = [
    ['3 el milde harissa', 'Pikante Saus'],
    ['75 g veldsla', 'Rucola'],
    ['150 g kwark', 'Yoghurt'],
    ['8 runderchipolata', 'Worst'],
    ['250 g romaatjes', 'Cherrytomaten'],
    ['4 el zuivelspread bieslook light', 'Roomkaas'],
    ['250 g fruit', 'Uien'],
    ['250 g champignons', 'Ham'],
    ['1 perzik', 'Peren'],
    ['1 aardappel', 'Zoete aardappelen'],
    ['', 'Melk'],
    ['500 ml melk', '']
];

describe('matching a product to an ingredient line', () => {
    it('brings Dutch word forms to one stem', () => {
        assert.deepEqual(
            [
                'Tomaten',
                'tomaat',
                'Uien',
                'ui',
                'Eieren',
                'ei',
                'Olijven',
                'olijf',
                'Kazen',
                'kaas',
                'Peren',
                'peer'
            ].map(stem),
            ['tomat', 'tomat', 'ui', 'ui', 'ei', 'ei', 'olijf', 'olijf', 'kas', 'kas', 'per', 'per']
        );
        assert.deepEqual(['Tortillas', 'Koekjes', 'Crème', 'Bessen', 'bes'].map(stem), [
            'tortilla',
            'koek',
            'crem',
            'bes',
            'bes'
        ]);
    });

    it('finds a product whose name is in the line, as a word of its own or as the start or end of a longer one', () => {
        for (const [line, name] of FITTING) {
            assert.equal(fits(line, name), true, `${line} -> ${name}`);
        }
    });

    it('refuses a product whose name is not in the line', () => {
        for (const [line, name] of NOT_FITTING) {
            assert.equal(fits(line, name), false, `${line} -> ${name}`);
        }
    });

    it('takes the narrower product that also fits and holds the picked name', () => {
        const products = [
            'Kruiden',
            'Koekkruiden',
            'Tomaten',
            'Tomatenpuree',
            'Tomatensaus',
            'Melk',
            'Karnemelk',
            'Bloem',
            'Bloemen'
        ].map((name, index) => ({ id: index + 1, name }));
        const pick = (line: string, name: string): string =>
            mostSpecific(line, products.find((product) => product.name === name) ?? products[0], products).name;

        assert.equal(pick('2 el koekkruiden', 'Kruiden'), 'Koekkruiden');
        assert.equal(pick('1 blik tomatenpuree', 'Tomaten'), 'Tomatenpuree');
        assert.equal(pick('3 tomaten', 'Tomaten'), 'Tomaten');
        assert.equal(pick('500 ml melk', 'Melk'), 'Melk');
        assert.equal(pick('500 g bloem', 'Bloem'), 'Bloem');
        assert.equal(pick('2 el koekkruiden', 'Koekkruiden'), 'Koekkruiden');
    });
});
