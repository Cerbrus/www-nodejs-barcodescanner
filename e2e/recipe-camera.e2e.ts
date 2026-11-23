import { APIRequestContext, expect, test } from '@playwright/test';

import { listOf } from './helpers';
import { CAMERA_RECIPE } from './playwright.config';

const toBuy = async (request: APIRequestContext): Promise<number> =>
    (await listOf(request))
        .filter((entry) => entry.catalogItemId === CAMERA_RECIPE.productId && entry.state === 'to_buy')
        .reduce((total, entry) => total + entry.quantity, 0);

test('read a recipe code with the camera, tick what to buy, and keep the recipe', async ({ page, request }) => {
    const before = await toBuy(request);

    await page.goto('/#/scan');
    const sheet = page.locator('app-recipe-sheet');
    await expect(sheet.getByRole('heading', { name: CAMERA_RECIPE.name })).toBeVisible({ timeout: 20_000 });
    await expect(sheet.locator('label.choice input')).toBeChecked();
    await expect(sheet.locator('.choice.unknown')).toContainText('weg');

    await sheet.locator('.keep input').check();
    await sheet.locator('button.primary').click();

    await expect(page.getByText(`${CAMERA_RECIPE.name}: 1 product op de lijst`)).toBeVisible();
    await expect.poll(() => toBuy(request)).toBe(before + CAMERA_RECIPE.quantity);

    await page.goto('/#/recipes');
    await expect(page.locator('a.recipe-link', { hasText: CAMERA_RECIPE.name })).toBeVisible();
    await page.goto('/#/inbox');
    await expect(page.locator('.offer')).toHaveCount(0);
});
