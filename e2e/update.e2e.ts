import { expect, test } from '@playwright/test';

const NEW_MAIN = 'main-ZZZZZZZZ.js';

test.use({ serviceWorkers: 'block' });

test('a new version replaces the running app without a page load', async ({ page }) => {
    await page.goto('/#/system');
    await expect(page.locator('app-system-page')).toBeVisible();

    const oldMain = await page.evaluate(() =>
        new URL(document.querySelector<HTMLScriptElement>('script[src^="main-"]')?.src ?? '').pathname.slice(1)
    );
    await page.evaluate(() => ((window as unknown as { sameDocument: boolean }).sameDocument = true));

    await page.route('**/app-files.json', async (route) => {
        const files: Array<string> = await (await route.fetch()).json();
        await route.fulfill({ json: files.map((file) => (file === oldMain ? NEW_MAIN : file)) });
    });
    await page.route(/\/$/, async (route) => {
        const answer = await route.fetch();
        await route.fulfill({ response: answer, body: (await answer.text()).replace(oldMain, NEW_MAIN) });
    });
    await page.route(`**/${NEW_MAIN}`, async (route) => {
        await route.fulfill({ response: await route.fetch({ url: route.request().url().replace(NEW_MAIN, oldMain) }) });
    });

    let streams = 0;
    page.on('request', (request) => request.url().endsWith('/api/v1/events') && streams++);
    let loads = 0;
    page.on('load', () => loads++);
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));

    await expect(page.locator(`script[src="/${NEW_MAIN}"]`)).toBeAttached({ timeout: 15_000 });
    await expect(page.locator(`script[src="/${oldMain}"]`)).toHaveCount(0);
    await expect(page.locator('app-root[ng-version] app-system-page')).toBeVisible();

    expect(await page.evaluate(() => (window as unknown as { sameDocument?: boolean }).sameDocument)).toBe(true);
    expect(loads).toBe(0);
    expect(streams).toBe(1);

    await page.locator('app-shell a[href$="/list"], a[href$="/list"]').first().click();
    await expect(page.locator('app-list-page')).toBeVisible();
});
