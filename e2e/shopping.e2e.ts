import { expect, test } from '@playwright/test';

import { TYPED_CODE, listOf, nameInPrompt, productOffTheList, tile } from './helpers';

test.describe.configure({ mode: 'serial' });

test('type a code, name it, check it off and undo', async ({ page, request }) => {
    const product = await productOffTheList(request);

    await page.goto('/#/scan');
    await page.locator('form.manual input').fill(TYPED_CODE);
    await page.locator('form.manual button[type=submit]').click();
    await nameInPrompt(page, product.name);
    await expect(page.getByText(`Gekoppeld aan ${product.name}`)).toBeVisible();

    await page.goto('/#/list');
    await expect(tile(page, 'buy', product.name)).toBeVisible();

    await tile(page, 'buy', product.name).locator('button.tile').click();
    await expect(page.getByText(`${product.name} afgevinkt`)).toBeVisible();
    await expect(tile(page, 'recent', product.name)).toBeVisible();

    await page.getByRole('button', { name: 'Ongedaan maken' }).click();
    await expect(tile(page, 'buy', product.name)).toBeVisible();

    const entry = (await listOf(request)).find((row) => row.catalogItemId === product.id);
    expect(entry?.state).toBe('to_buy');
});

test('scan the same code again and get one more', async ({ page, request }) => {
    const before = (await listOf(request)).length;

    const answers: Array<string> = [];
    page.on('response', async (response) => {
        if (response.url().endsWith('/api/v1/scans') && response.request().method() === 'POST') {
            answers.push(await response.text());
        }
    });

    await page.goto('/#/scan');
    await page.locator('form.manual input').fill(TYPED_CODE);
    await page.locator('form.manual button[type=submit]').click();
    await expect.poll(() => answers.length).toBeGreaterThan(0);

    const history = await (await request.get('/api/v1/scans?limit=10')).text();
    expect(answers.map((answer) => JSON.parse(answer).result), `answers: ${answers.join(' | ')}
history: ${history}`).toEqual(['incremented']);
    await expect(page.getByText(/: nu 2$/)).toBeVisible();
    expect((await listOf(request)).length).toBe(before);
});

test('shop without a connection and send the change later', async ({ page, context, request }) => {
    await page.goto('/#/list');
    const name = (await page.locator('app-item-tile:has(button.tile.buy) .name').first().innerText()).trim();
    await page.waitForFunction(async () => {
        const kept = await (await caches.open('app-files-v1')).keys();

        return navigator.serviceWorker.controller !== null && kept.some((file) => /main-.*\.js$/.test(file.url)) && kept.some((file) => new URL(file.url).pathname === '/');
    });

    await context.setOffline(true);
    await page.reload();
    await expect(tile(page, 'buy', name)).toBeVisible();

    await tile(page, 'buy', name).locator('button.tile').click();
    await expect(tile(page, 'recent', name)).toBeVisible();
    await expect(page.getByText('1 wijziging wacht')).toBeVisible();
    expect((await listOf(request)).find((entry) => entry.catalogItem.name === name)?.state).toBe('to_buy');

    await context.setOffline(false);
    await expect(page.getByText('1 wijziging wacht')).toBeHidden({ timeout: 20_000 });
    await expect.poll(async () => (await listOf(request)).find((entry) => entry.catalogItem.name === name)?.state).toBe('recent');
});

test('other pages open, and the browser reported nothing the content policy would block', async ({ page, request }) => {
    for (const [address, heading] of [
        ['/#/inbox', 'Inbox'],
        ['/#/catalog', 'Producten'],
        ['/#/system', 'Systeem'],
        ['/#/sounds', 'Geluid bij de scanner'],
        ['/#/history', 'Scangeschiedenis']
    ]) {
        await page.goto(address);
        await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    }

    const lines = (await (await request.get('/api/v1/logs?limit=500')).json()) as Array<{ message: string }>;

    expect(lines.filter((line) => line.message.includes('content policy')).map((line) => line.message)).toEqual([]);
});
