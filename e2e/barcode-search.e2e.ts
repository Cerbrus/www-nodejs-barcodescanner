import { expect, test } from '@playwright/test';

import { withCheckDigit } from './barcode-video.mjs';
import { productOffTheList } from './helpers';

const VARIANT = 'Mild';

test('search barcodes for a product by its name and link the ticked one with its variant', async ({
    page,
    request
}) => {
    const code = withCheckDigit('871040099007');
    const taken = withCheckDigit('871040099008');
    const product = await productOffTheList(request);
    const asked: Array<URLSearchParams> = [];

    await page.route('**/api/v1/barcode-candidates?*', (route) => {
        asked.push(new URL(route.request().url()).searchParams);

        return route.fulfill({
            json: [
                {
                    code,
                    suggestions: [{ connectorId: 'off', title: `${product.name} mild`, brand: 'Huismerk' }],
                    size: '500 g',
                    note: VARIANT,
                    shopCode: false
                },
                {
                    code: taken,
                    suggestions: [{ connectorId: 'off', title: 'Iets anders' }],
                    note: '',
                    shopCode: false,
                    catalogItem: { id: 999999, name: 'Ander product' }
                }
            ]
        });
    });

    await page.goto(`/#/catalog/${product.id}`);
    await page.locator('button.search-barcodes').click();

    const sheet = page.locator('app-barcode-search');
    await expect(sheet.locator('#barcode-search-words')).toHaveValue(product.name);
    await expect(sheet.locator('.hit-title')).toHaveText([`${product.name} mild`, 'Iets anders']);
    await expect(sheet.locator('.hit-detail').first()).toHaveText(`Huismerk · 500 g · ${code}`);
    await expect(sheet.locator('input[type=checkbox]')).toHaveCount(1);
    expect([asked[0].get('query'), asked[0].get('catalogItemId')]).toEqual([product.name, String(product.id)]);

    await sheet.locator(`#barcode-hit-${code}`).check();
    await expect(sheet.locator(`#barcode-note-${code}`)).toHaveValue(VARIANT);
    await sheet.locator('button.primary').click();

    await expect(sheet).toHaveCount(0);
    await expect(page.locator('.card .font-mono')).toHaveText([code]);
    await expect(page.locator('.barcode-variant')).toContainText(VARIANT);

    const barcode = (await (await request.get(`/api/v1/barcodes/${code}`)).json()) as {
        catalogItemId?: number;
        note?: string;
    };
    expect([barcode.catalogItemId, barcode.note]).toEqual([product.id, VARIANT]);
    expect((await request.get(`/api/v1/barcodes/${taken}`)).status()).toBe(404);
});
