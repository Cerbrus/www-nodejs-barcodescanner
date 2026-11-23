import { expect, test } from '@playwright/test';

import { withCheckDigit } from './barcode-video.mjs';
import { ListEntry, listOf, nameInPrompt, pastTheRepeatPause, productOffTheList, tile } from './helpers';

test.describe.configure({ mode: 'serial' });

const MODE_CODE = withCheckDigit('871040099005');

test('the collect toggle of the scanner moves a scanned product from the list to recent, and names an unknown barcode from the list', async ({
    page,
    request
}) => {
    const product = await productOffTheList(request);
    await request.patch(`/api/v1/list/${crypto.randomUUID()}`, {
        data: { catalogItemId: product.id, state: 'to_buy', quantity: 1 }
    });
    const stateOf = async (): Promise<ListEntry['state'] | undefined> =>
        (await listOf(request)).find((row) => row.catalogItemId === product.id)?.state;

    await page.goto('/#/scan');
    await page.locator('button.collect').click();
    await expect(page.locator('button.collect')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('form.manual input').fill(MODE_CODE);
    await page.locator('form.manual button[type=submit]').click();
    await expect(page.locator('app-naming-prompt .sheet')).toBeVisible();
    await expect(page.locator('app-naming-prompt .flex-wrap button', { hasText: product.name })).toBeVisible();
    await nameInPrompt(page, product.name);
    expect(await stateOf()).toBe('recent');

    await page.locator('nav a[href="#/list"]').click();
    await expect(tile(page, 'recent', product.name)).toBeVisible();

    await pastTheRepeatPause(request);
    await page.locator('nav a[href="#/scan"]').click();
    await expect(page.locator('button.collect')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('form.manual input').fill(MODE_CODE);
    await page.locator('form.manual button[type=submit]').click();
    await expect(page.getByText(`${product.name} staat niet op de lijst`)).toBeVisible();
    expect(await stateOf()).toBe('recent');

    await page.locator('button.collect').click();
    await expect(page.locator('button.collect')).toHaveAttribute('aria-pressed', 'false');
    await pastTheRepeatPause(request);
    await page.locator('form.manual input').fill(MODE_CODE);
    await page.locator('form.manual button[type=submit]').click();
    await expect(page.getByText(`${product.name} staat op de lijst`)).toBeVisible();
    expect(await stateOf()).toBe('to_buy');
});
