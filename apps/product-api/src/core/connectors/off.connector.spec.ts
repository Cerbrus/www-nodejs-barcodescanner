import 'reflect-metadata';

import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';

import { OpenFoodFactsConnector } from './off.connector';

const answerWith = (status: number, body: unknown): Array<URL> => {
    const asked: Array<URL> = [];
    mock.method(globalThis, 'fetch', (address: string) => {
        asked.push(new URL(address));

        return Promise.resolve(new Response(JSON.stringify(body), { status }));
    });

    return asked;
};

describe('Open Food Facts search', () => {
    const connector = new OpenFoodFactsConnector();

    afterEach(() => mock.restoreAll());

    it('asks for products in the Netherlands and reads a barcode, name, brand and size from every hit', async () => {
        const asked = answerWith(200, {
            hits: [
                {
                    code: '8710400002994',
                    product_name: 'melk hagelslag',
                    brands: ['xx:albert-heijn'],
                    quantity: '250 g'
                },
                { code: '5410063012295', product_name: 'Hagelslag melk' },
                { code: '8718906716230', brands: ['xx:albert-heijn'] },
                { product_name: 'Zonder code' }
            ]
        });

        assert.deepEqual(await connector.search('hagelslag melk'), [
            {
                code: '8710400002994',
                suggestion: { connectorId: 'off', title: 'melk hagelslag', brand: 'albert heijn' },
                size: '250 g'
            },
            {
                code: '5410063012295',
                suggestion: { connectorId: 'off', title: 'Hagelslag melk', brand: undefined },
                size: undefined
            }
        ]);
        assert.equal(asked.length, 1);
        assert.equal(asked[0].origin + asked[0].pathname, 'https://search.openfoodfacts.org/search');
        assert.equal(asked[0].searchParams.get('q'), 'hagelslag melk countries:"en:netherlands"');
        assert.equal(asked[0].searchParams.get('fields'), 'code,product_name,brands,quantity');
    });

    it('gives nothing for an answer without hits, and fails when the search does not answer', async () => {
        answerWith(200, {});
        assert.deepEqual(await connector.search('melk'), []);

        mock.restoreAll();
        answerWith(503, {});
        await assert.rejects(connector.search('melk'), /search answered 503/);
    });
});
