import { Page, expect, test } from '@playwright/test';

const look = (page: Page): Promise<{ background: string; font: string; border: string; bar: string | null }> =>
    page.evaluate(() => ({
        background: getComputedStyle(document.body).backgroundColor,
        font: getComputedStyle(document.body).fontFamily,
        border: getComputedStyle(document.querySelector('.card') as HTMLElement).borderTopWidth,
        bar: (document.querySelector('meta[name="theme-color"]') as HTMLMetaElement).content
    }));

test('pick a theme, switch it between light and dark, and find it again after a reload', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/#/system');
    const themes = page.locator('app-skin-select select');
    const appearance = page.locator('.row.choice').nth(1).locator('.segment');
    await expect(themes).toHaveValue('default');
    const standard = await look(page);

    expect(standard).toMatchObject({ background: 'rgb(243, 244, 246)', border: '1px', bar: 'rgb(15, 118, 110)' });

    await themes.selectOption('comic');

    await expect.poll(() => look(page)).toMatchObject({ background: 'rgb(255, 244, 204)', border: '3px' });
    expect((await look(page)).font).toContain('Comic Neue');
    expect((await look(page)).bar).toBe('rgb(21, 84, 240)');

    await appearance.nth(2).click();

    await expect.poll(() => look(page)).toMatchObject({ background: 'rgb(43, 43, 64)', bar: 'rgb(255, 214, 10)' });

    await page.reload();

    await expect(themes).toHaveValue('comic');
    expect(await look(page)).toMatchObject({ background: 'rgb(43, 43, 64)', border: '3px' });

    await themes.selectOption('default');
    await appearance.nth(0).click();

    await expect.poll(() => look(page)).toEqual(standard);
});
