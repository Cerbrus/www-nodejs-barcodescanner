import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { brandName, isShopCode, orderHits, searchWords, variantFor } from './barcode-search';

describe('barcode search rules', () => {
    it('takes a code that starts with 00 or 2, or is not 8 or 13 digits long, for one a shop made up', () => {
        assert.equal(isShopCode('8710400002994'), false);
        assert.equal(isShopCode('0000210066210'), true);
        assert.equal(isShopCode('2012345678901'), true);
        assert.equal(isShopCode('00156211'), true);
        assert.equal(isShopCode('87654321'), false);
        assert.equal(isShopCode('22223333'), true);
        assert.equal(isShopCode('871040033548'), true);
    });

    it('puts the codes a shop made up last, keeps the order otherwise, and drops what is no barcode or came twice', () => {
        const hits = ['0000210066210', '8710400002994', 'abc', '00156211', '87654321', '8710400002994', ''].map(
            (code) => ({ code })
        );

        assert.deepEqual(
            orderHits(hits).map(({ code }) => code),
            ['8710400002994', '87654321', '0000210066210', '00156211']
        );
    });

    it('reads a brand from the tags of the search', () => {
        assert.equal(brandName(['xx:albert-heijn']), 'albert heijn');
        assert.equal(brandName(['xx:calve', 'en:unilever']), 'calve, unilever');
        assert.equal(brandName('Calvé'), 'Calvé');
        assert.equal(brandName([]), undefined);
        assert.equal(brandName(undefined), undefined);
    });

    it('keeps the letters and digits of the search words, so they cannot steer the search', () => {
        assert.equal(searchWords('  AH  halfvolle melk '), 'AH halfvolle melk');
        assert.equal(searchWords('melk" OR countries:"en:belgium'), 'melk OR countries en belgium');
        assert.equal(searchWords("g'woon crème-fraîche"), "g'woon crème-fraîche");
    });

    it('proposes as variant what a title says beside the name of the product, the first source that says more first', () => {
        const milk = { id: 1, name: 'Melk' };

        assert.equal(
            variantFor([{ title: 'AH Halfvolle melk 1l', brand: 'AH' }, { title: 'Melk' }], milk),
            'Halfvolle'
        );
        assert.equal(variantFor([{ title: 'Melk' }, { title: 'Volle melk' }], milk), 'Volle');
        assert.equal(variantFor([{ title: 'Melk' }], milk), '');
        assert.equal(variantFor([{ title: 'Pindakaas met stukjes' }], milk), '');
        assert.equal(variantFor([], milk), '');
    });
});
