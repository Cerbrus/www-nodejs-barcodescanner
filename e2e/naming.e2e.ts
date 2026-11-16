import { APIRequestContext, Page, expect, test } from '@playwright/test';

import { withCheckDigit } from './barcode-video.mjs';
import { CatalogItem, listOf, productOffTheList } from './helpers';

const VARIANT = 'Halfvolle';

test.describe.configure({ mode: 'serial' });

const anotherProduct = async (request: APIRequestContext, besides: CatalogItem): Promise<CatalogItem> => {
    const catalog = (await (await request.get('/api/v1/catalog')).json()) as Array<CatalogItem>;
    const listed = new Set((await listOf(request)).map((entry) => entry.catalogItemId));

    return catalog.find(
        (item) => item.id !== besides.id && !listed.has(item.id) && !item.name.includes(besides.name)
    ) as CatalogItem;
};

const scanWithProposal = async (page: Page, code: string, proposed: CatalogItem): Promise<void> => {
    await page.route(`**/api/v1/barcodes/${code}`, async (route) => {
        if (route.request().method() !== 'GET') {
            return route.continue();
        }

        const response = await route.fetch();
        const barcode = (await response.json()) as object;

        return route.fulfill({
            response,
            json: { ...barcode, proposal: { catalogItemId: proposed.id, name: proposed.name, note: VARIANT } }
        });
    });

    await page.goto('/#/scan');
    await page.locator('form.manual input').fill(code);
    await page.locator('form.manual button[type=submit]').click();
    await expect(page.locator('app-naming-prompt .proposal')).toContainText(proposed.name);
    await expect(page.locator('#naming-variant')).toHaveValue(VARIANT);
};

const barcodeOf = async (
    request: APIRequestContext,
    code: string
): Promise<{ catalogItemId?: number; note?: string }> => (await request.get(`/api/v1/barcodes/${code}`)).json();

test('link the proposed product with its variant in one tap', async ({ page, request }) => {
    const code = withCheckDigit('871040099003');
    const proposed = await productOffTheList(request);

    await scanWithProposal(page, code, proposed);
    await page.locator('app-naming-prompt .proposal button.primary').click();
    await expect(page.locator('app-naming-prompt')).toHaveCount(0);

    const barcode = await barcodeOf(request, code);
    expect([barcode.catalogItemId, barcode.note]).toEqual([proposed.id, VARIANT]);
    expect((await listOf(request)).some((entry) => entry.catalogItemId === proposed.id && entry.note === VARIANT)).toBe(
        true
    );
});

test('pick another product than the proposed one, without the proposed variant', async ({ page, request }) => {
    const code = withCheckDigit('871040099004');
    const other = await productOffTheList(request);
    const proposed = await anotherProduct(request, other);

    await scanWithProposal(page, code, proposed);
    const prompt = page.locator('app-naming-prompt');
    await prompt.locator('app-item-autocomplete input').fill(other.name);
    await expect(page.locator('#naming-variant')).toHaveValue('');
    await prompt.locator('app-item-autocomplete .option').first().click();
    await expect(prompt).toHaveCount(0);

    const barcode = await barcodeOf(request, code);
    expect([barcode.catalogItemId, barcode.note ?? '']).toEqual([other.id, '']);
    expect((await listOf(request)).some((entry) => entry.catalogItemId === other.id && entry.note === '')).toBe(true);
});
