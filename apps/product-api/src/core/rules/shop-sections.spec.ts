import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { sectionForCategory } from './shop-sections';

describe('section from the shop category', () => {
    it('maps the categories Albert Heijn sent so far', () => {
        assert.equal(sectionForCategory('Zuivel, eieren'), 'zuivel');
        assert.equal(sectionForCategory('Ontbijtgranen, beleg'), 'graanproducten');
        assert.equal(sectionForCategory('Maaltijden, salades'), 'gereed-diepvries');
    });

    it('maps the other main categories of Albert Heijn', () => {
        assert.equal(sectionForCategory('Aardappel, groente, fruit'), 'fruit-groenten');
        assert.equal(sectionForCategory('Vlees, kip, vis, vega'), 'vlees-vis');
        assert.equal(sectionForCategory('Kaas, vleeswaren, tapas'), 'zuivel');
        assert.equal(sectionForCategory('Bakkerij, banket'), 'brood-gebak');
        assert.equal(sectionForCategory('Snoep, koek, chips, chocolade'), 'snacks-snoep');
        assert.equal(sectionForCategory('Frisdrank, sappen, koffie, thee'), 'dranken');
        assert.equal(sectionForCategory('Bier, wijn, aperitieven'), 'dranken');
        assert.equal(sectionForCategory('Pasta, rijst, wereldkeuken'), 'graanproducten');
        assert.equal(sectionForCategory('Soepen, sauzen, kruiden, olie'), 'ingredienten-kruiden');
        assert.equal(sectionForCategory('Soepen'), 'gereed-diepvries');
        assert.equal(sectionForCategory('Diepvries'), 'gereed-diepvries');
        assert.equal(sectionForCategory('Drogisterij'), 'verzorging-gezondheid');
        assert.equal(sectionForCategory('Huishouden'), 'huishouden');
        assert.equal(sectionForCategory('Huisdier'), 'dierenvoeding');
    });

    it('also understands the English categories of Open Food Facts', () => {
        assert.equal(sectionForCategory('semi skimmed milks'), 'zuivel');
        assert.equal(sectionForCategory('colas'), 'dranken');
        assert.equal(sectionForCategory('confectionary based spreads'), 'graanproducten');
    });

    it('gives nothing for no category or an unknown one', () => {
        assert.equal(sectionForCategory(undefined), undefined);
        assert.equal(sectionForCategory(''), undefined);
        assert.equal(sectionForCategory('gadgets'), undefined);
    });
});
