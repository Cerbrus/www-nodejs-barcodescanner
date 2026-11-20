import { APIRequestContext, expect, test } from '@playwright/test';

interface Remark {
    kind: string;
    text: string;
    page: string;
    target?: { component?: string; text?: string };
    context?: { version?: string; viewport?: string };
}

const remarksOf = async (request: APIRequestContext): Promise<Array<Remark>> =>
    (await (await request.get('/api/v1/remarks')).json()).remarks;

test.describe.configure({ mode: 'serial' });

test('right-click a product, write a bug, and find it on the feedback page', async ({ page, request }) => {
    await page.goto('/#/list');
    const tile = page.locator('app-item-tile:has(button.tile.buy)').first();
    await expect(tile).toBeVisible();
    const name = (await tile.locator('.name').innerText()).trim();

    await tile.locator('button.tile').click({ button: 'right' });
    await expect(page.locator('app-remark-sheet .sheet')).toBeVisible();
    await expect(page.locator('app-remark-sheet .about')).toContainText(name);

    await page.locator('app-remark-sheet textarea').fill('The count is hard to read');
    await page.locator('app-remark-sheet button.primary').click();
    await expect(page.getByText('Bedankt voor je feedback!')).toBeVisible();
    await expect(tile.locator('button.tile.buy')).toBeVisible();

    const [remark] = await remarksOf(request);
    expect([remark.kind, remark.text, remark.page]).toEqual(['bug', 'The count is hard to read', '#/list']);
    expect(remark.target?.component).toBe('app-item-tile');
    expect(remark.target?.text).toContain(name);
    expect(remark.context?.viewport).toBe('390 × 844');

    await page.goto('/#/system');
    await page.locator('a.row.link[href="#/remarks"]').click();
    await expect(page.locator('article .text')).toHaveText(['The count is hard to read']);

    await page.locator('article .menu-anchor > button').click();
    await page.locator('.menu button', { hasText: 'edit' }).click();
    await page.locator('article textarea').fill('The count is hard to read in the dark');
    await page.locator('article button.primary').click();
    await expect(page.locator('article .text')).toHaveText(['The count is hard to read in the dark']);
    expect((await remarksOf(request))[0].text).toBe('The count is hard to read in the dark');
});

test('point at a part of the app from the settings, and write a wish about it', async ({ page, request }) => {
    await page.goto('/#/system');
    await page.getByRole('button', { name: 'Aanwijzen' }).click();
    await expect(page.getByText('Tik op wat je bedoelt')).toBeVisible();

    await page.locator('nav a[href="#/list"]').click();
    await expect(page.getByText('Tik op wat je bedoelt')).toBeVisible();
    await expect(page.locator('button.tile.buy').first()).toBeVisible();
    const before = await page.locator('button.tile.buy').count();

    await page.locator('button.tile.buy').first().click();
    await expect(page.locator('app-remark-sheet .sheet')).toBeVisible();
    await expect(page.getByText('Tik op wat je bedoelt')).toBeHidden();

    await page.getByRole('button', { name: 'Wens' }).click();
    await page.locator('app-remark-sheet textarea').fill('Sort by aisle');
    await page.locator('app-remark-sheet button.primary').click();
    await expect(page.locator('app-remark-sheet .sheet')).toBeHidden();

    expect(await page.locator('button.tile.buy').count()).toBe(before);
    expect((await remarksOf(request))[0]).toMatchObject({ kind: 'wish', text: 'Sort by aisle', page: '#/list' });
});

test('point at the bottom menu: the active tab is picked, another tab navigates, and right click works', async ({
    page,
    request
}) => {
    await page.goto('/#/system');
    await page.getByRole('button', { name: 'Aanwijzen' }).click();
    await page.locator('nav a[href="#/list"]').click();
    await expect(page).toHaveURL(/#\/list$/);
    await expect(page.locator('app-remark-sheet .sheet')).toBeHidden();

    await page.locator('nav a[href="#/list"]').click();
    await expect(page.locator('app-remark-sheet .sheet')).toBeVisible();
    await expect(page).toHaveURL(/#\/list$/);
    await page.getByRole('button', { name: 'Wens' }).click();
    await page.locator('app-remark-sheet textarea').fill('Menu wish');
    await page.locator('app-remark-sheet button.primary').click();
    await expect(page.locator('app-remark-sheet .sheet')).toBeHidden();
    expect((await remarksOf(request))[0]).toMatchObject({ text: 'Menu wish', page: '#/list' });

    await page.locator('nav a[href="#/catalog"]').click({ button: 'right' });
    await expect(page.locator('app-remark-sheet .sheet')).toBeVisible();
    await expect(page).toHaveURL(/#\/list$/);
    await page.locator('app-remark-sheet').getByRole('button', { name: 'Annuleren' }).click();
});

test('send with Ctrl+Enter, and choose what happens to the text when closing', async ({ page, request }) => {
    await page.goto('/#/remarks');
    await page.getByRole('button', { name: 'Schrijven' }).click();
    await page.locator('app-remark-sheet textarea').fill('Half written');
    await page.locator('app-remark-sheet').getByRole('button', { name: 'Annuleren' }).click();
    await expect(page.getByText('Weet je zeker dat je dit formulier wilt sluiten?')).toBeVisible();
    await page
        .locator('app-remark-sheet')
        .getByRole('button', { name: / Sluiten$/ })
        .click();
    await expect(page.locator('app-remark-sheet .sheet')).toBeHidden();

    await page.getByRole('button', { name: 'Schrijven' }).click();
    await expect(page.locator('app-remark-sheet textarea')).toHaveValue('Half written');
    await page.locator('app-remark-sheet textarea').press('Control+Enter');
    await expect(page.locator('app-remark-sheet .sheet')).toBeHidden();
    expect((await remarksOf(request))[0]).toMatchObject({ text: 'Half written' });
});

test('write a note without a connection and see it arrive later', async ({ page, context, request }) => {
    await page.goto('/#/system');
    await expect(page.getByRole('button', { name: 'Schrijven' })).toBeVisible();
    const before = (await remarksOf(request)).length;

    await context.setOffline(true);
    await page.getByRole('button', { name: 'Schrijven' }).click();
    await page.getByRole('button', { name: 'Notitie' }).click();
    await page.locator('app-remark-sheet textarea').fill('Written in the shop');
    await page.locator('app-remark-sheet button.primary').click();
    await expect(page.getByText('Bewaard; wordt verstuurd zodra er verbinding is')).toBeVisible();
    expect((await remarksOf(request)).length).toBe(before);

    await context.setOffline(false);
    await expect.poll(async () => (await remarksOf(request))[0]?.text, { timeout: 20_000 }).toBe('Written in the shop');
});
