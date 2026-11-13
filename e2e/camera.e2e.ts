import { expect, test } from '@playwright/test';

import { listOf, nameInPrompt, productOffTheList } from './helpers';
import { CAMERA_CODE } from './playwright.config';

test('read a barcode with the camera', async ({ page, request }) => {
    const product = await productOffTheList(request);

    await page.goto('/#/scan');
    await expect(page.locator('.camera .frame')).toBeVisible();
    await expect(page.locator('.camera .last')).toContainText(CAMERA_CODE, { timeout: 20_000 });
    await nameInPrompt(page, product.name);

    expect((await listOf(request)).some((entry) => entry.catalogItemId === product.id && entry.state === 'to_buy')).toBe(true);
});
