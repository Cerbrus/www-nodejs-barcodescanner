import { APIRequestContext, expect, test } from '@playwright/test';

import { listOf, productOffTheList } from './helpers';

const NAME = 'Proefrecept';

const toBuy = async (request: APIRequestContext, catalogItemId: number): Promise<number> =>
    (await listOf(request)).find((entry) => entry.catalogItemId === catalogItemId && entry.state === 'to_buy')
        ?.quantity ?? 0;

test('make a recipe, put it on the list from its row, undo, and add it again through the tick sheet', async ({
    page,
    request
}) => {
    const product = await productOffTheList(request);

    await page.goto('/#/recipes');
    await expect(page.getByRole('heading', { name: 'Recepten', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Nieuw recept' }).click();
    await page.locator('#recipe-name').fill(NAME);
    await page.locator('#recipe-description').fill('Eerst **roeren**.');
    await page.locator('app-item-autocomplete input').fill(product.name);
    await page.locator('app-item-autocomplete .option').first().click();
    await page.getByRole('button', { name: 'Eén meer' }).click();
    await page.getByRole('button', { name: 'Opslaan' }).click();

    await expect(page.getByRole('heading', { name: NAME, exact: true })).toBeVisible();
    await expect(page.locator('app-markdown strong')).toHaveText('roeren');
    await expect(page.locator('.ingredient')).toContainText(product.name);

    await page.goto('/#/recipes');
    await page.getByRole('button', { name: `Alles van ${NAME} op de lijst zetten` }).click();
    await expect(page.getByText(`${NAME}: 1 product op de lijst`)).toBeVisible();
    await expect.poll(() => toBuy(request, product.id)).toBe(2);

    await page.getByRole('button', { name: 'Ongedaan maken' }).click();
    await expect.poll(() => toBuy(request, product.id)).toBe(0);

    await page.locator('a.recipe-link', { hasText: NAME }).click();
    await page.locator('button.primary', { hasText: 'Op lijst' }).click();
    await expect(page.locator('app-recipe-sheet input[type=checkbox]')).toBeChecked();
    await page.locator('app-recipe-sheet button.primary').click();
    await expect.poll(() => toBuy(request, product.id)).toBe(2);

    await page.goto('/#/history');
    await expect(page.locator('.recipe-line', { hasText: NAME }).first()).toBeVisible();
});
