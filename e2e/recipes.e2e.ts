import { APIRequestContext, expect, test } from '@playwright/test';
import sharp from 'sharp';

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
    const photo = await sharp({ create: { width: 800, height: 400, channels: 3, background: '#cc6633' } })
        .png()
        .toBuffer();

    await page.goto('/#/recipes');
    await expect(page.getByRole('heading', { name: 'Recepten', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Nieuw recept' }).click();
    await page.locator('#recipe-name').fill(NAME);
    await expect(page.getByRole('button', { name: 'Opslaan' })).toBeDisabled();
    await page.locator('#recipe-category').selectOption({ label: 'Avondeten' });
    await page.locator('#recipe-description').fill('Eerst **roeren**.');
    await page.locator('app-item-autocomplete input').fill(product.name);
    await page.locator('app-item-autocomplete .option').first().click();
    await page.getByRole('button', { name: 'Eén meer' }).click();
    await expect(page.locator('input.ingredient-text')).toHaveAttribute('placeholder', `${product.name} ×2`);
    await page.getByRole('button', { name: 'Opslaan' }).click();

    await expect(page.getByRole('heading', { name: NAME, exact: true })).toBeVisible();
    await expect(page.locator('app-markdown strong')).toHaveText('roeren');
    await expect(page.locator('.ingredient-lines li')).toHaveText(`${product.name} ×2`);
    await expect(page.locator('.ingredient')).toHaveCount(0);

    await page.getByRole('button', { name: 'Recept bewerken' }).click();
    await page.locator('input.ingredient-text').fill('2 flessen *afwasmiddel*');
    await page.getByRole('button', { name: 'Opslaan' }).click();
    await expect(page.locator('.ingredient-lines li')).toHaveText('2 flessen *afwasmiddel*');

    await page.getByRole('button', { name: 'Recept bewerken' }).click();
    await page.locator('#recipe-picture').setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: photo });
    await expect(page.locator('app-picture-cut .frame img.placed')).toBeVisible();
    await page.locator('#picture-zoom').fill('2');
    await page.getByRole('button', { name: 'Deze uitsnede gebruiken' }).click();
    await expect(page.locator('.picture-preview')).toBeVisible();
    await page.getByRole('button', { name: 'Opslaan' }).click();
    await expect(page.locator('img.picture')).toBeVisible();
    await expect
        .poll(() => page.locator('img.picture').evaluate((image: HTMLImageElement) => image.naturalWidth))
        .toBeGreaterThan(0);

    await page.goto('/#/recipes');
    await expect(page.locator('.recipe', { hasText: NAME }).locator('img.recipe-picture')).toBeVisible();
    await expect(page.locator('.section-title')).toContainText(['Avondeten']);
    await page.getByRole('button', { name: `Alles van ${NAME} op de lijst zetten` }).click();
    await expect(page.getByText(`${NAME}: 1 product op de lijst`)).toBeVisible();
    await expect.poll(() => toBuy(request, product.id)).toBe(2);

    await page.getByRole('button', { name: 'Ongedaan maken' }).click();
    await expect.poll(() => toBuy(request, product.id)).toBe(0);

    await page.locator('a.recipe-link', { hasText: NAME }).click();
    await page.getByRole('button', { name: 'Op lijst', exact: true }).click();
    await expect(page.locator('app-recipe-sheet input[type=checkbox]')).toBeChecked();
    await page.locator('app-recipe-sheet button.primary').click();
    await expect.poll(() => toBuy(request, product.id)).toBe(2);

    await page.goto('/#/history');
    await expect(page.locator('.recipe-line', { hasText: NAME }).first()).toBeVisible();
});

test('show the code of a recipe, and lay out the codes of chosen recipes for printing', async ({ page }) => {
    await page.addInitScript(() => {
        window.print = (): void => {
            document.body.dataset['printed'] = String(Number(document.body.dataset['printed'] ?? 0) + 1);
        };
    });
    await page.goto('/#/recipes');
    await page.locator('a.recipe-link', { hasText: NAME }).click();
    await expect(page.locator('app-recipe-code svg path')).toBeVisible();

    await page.getByRole('button', { name: 'Codes afdrukken' }).click();
    await expect(page.locator('body')).toHaveAttribute('data-printed', '1');
    await expect(page.locator('app-recipe-print .cell-name')).toHaveText([NAME]);
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await expect(page.locator('app-recipe-print .cell')).toHaveCount(0);

    await page.goto('/#/recipes');
    await page.getByRole('button', { name: 'Recepten kiezen' }).click();
    await expect(page.getByRole('button', { name: 'Codes afdrukken' })).toBeDisabled();
    await page.locator('.recipe input[type=checkbox]').first().check();
    await page.getByRole('button', { name: 'Codes afdrukken' }).click();

    await expect(page.locator('app-recipe-print .cell')).toHaveCount(1);
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('app-recipe-print .cell-code')).toBeVisible();
    await expect(page.locator('nav.tabs')).toBeHidden();
});

test('put a recipe on the list without a connection: it waits and arrives later', async ({
    page,
    context,
    request
}) => {
    const total = async (): Promise<number> =>
        (await listOf(request))
            .filter((entry) => entry.state === 'to_buy')
            .reduce((sum, entry) => sum + entry.quantity, 0);
    await page.goto('/#/recipes');
    const add = page.getByRole('button', { name: `Alles van ${NAME} op de lijst zetten` });
    await expect(add).toBeVisible();
    const before = await total();

    await context.setOffline(true);
    await add.click();
    await expect(page.getByText(`${NAME}: 1 product op de lijst`)).toBeVisible();
    await expect(page.getByText('1 wijziging wacht')).toBeVisible();
    expect(await total()).toBe(before);

    await context.setOffline(false);
    await expect(page.getByText('1 wijziging wacht')).toBeHidden({ timeout: 20_000 });
    await expect.poll(total).toBe(before + 2);
});

test('scan a recipe code the app does not have: it lands on the list and is offered in the inbox', async ({
    page,
    request
}) => {
    const product = await productOffTheList(request);
    const scanned = await request.post('/api/v1/scans', { data: { code: `R1;Gescand recept;${product.id}*2` } });

    expect(scanned.status()).toBe(201);
    await expect.poll(() => toBuy(request, product.id)).toBe(2);

    await page.goto('/#/inbox');
    await expect(page.locator('.offer', { hasText: 'Gescand recept' })).toBeVisible();
    await page.getByRole('button', { name: 'Gescand recept opslaan als recept' }).click();

    await expect(page.locator('#recipe-name')).toHaveValue('Gescand recept');
    await expect(page.locator('.ingredient-name')).toHaveText([product.name]);

    await page.goto('/#/inbox');
    await expect(page.locator('.offer')).toHaveCount(0);
});
