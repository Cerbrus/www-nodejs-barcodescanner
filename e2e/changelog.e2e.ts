import { expect, test } from '@playwright/test';

test('open the changelog from the System page and expand a release', async ({ page }) => {
    await page.goto('/#/system');
    await page.locator('a.row.link[href$="/changelog"]').click();

    const releases = page.locator('app-changelog-page .head');
    await expect(releases.first()).toBeVisible();
    await expect(page.locator('app-changelog-page .notes')).toHaveCount(0);

    await releases.first().click();
    await expect(page.locator('app-changelog-page .notes li').first()).toBeVisible();

    await releases.first().click();
    await expect(page.locator('app-changelog-page .notes')).toHaveCount(0);
});
