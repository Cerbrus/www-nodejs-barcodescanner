import { expect, test } from '@playwright/test';

interface Settings {
    events: Array<{ event: string; soundId: string }>;
    sounds: Array<{ id: string; name?: string; blocks: Array<{ kind: string }> }>;
}

test('make a sound from blocks, rename it and choose it for an event', async ({ page, request }) => {
    await page.goto('/#/sounds');
    await page.locator('button.new').click();

    const editor = page.locator('app-sound-editor');
    await expect(editor.locator('button.save')).toBeDisabled();
    await editor.locator('#sound-name').fill('Toeter');
    await editor.locator('button.add', { hasText: 'Triller' }).click();
    await expect(editor.locator('.block')).toHaveCount(2);
    await editor.locator('button.save').click();
    await expect(editor).toHaveCount(0);

    await page.locator('button.toggle').click();
    const made = page.locator('.row.preset', { hasText: 'Toeter' });
    await expect(made).toBeVisible();

    await made.getByRole('button', { name: 'Bewerken' }).click();
    await editor.locator('#sound-name').fill('');
    await expect(editor.locator('button.save')).toBeDisabled();
    await expect(editor.locator('button.save-new')).toBeDisabled();
    await editor.locator('#sound-name').fill('Claxon');
    await editor.locator('button.save').click();
    await expect(editor).toHaveCount(0);
    await expect(page.locator('.row.preset', { hasText: 'Claxon' })).toBeVisible();

    const event = page.locator('.row.event', { hasText: 'Onbekend product' });
    await event.locator('button.pick').click();
    await page.locator('.row.option', { hasText: 'Claxon' }).click();
    await expect(event).toContainText('Claxon');

    const settings = (await (await request.get('/api/v1/feedback/settings')).json()) as Settings;
    const sound = settings.sounds.find(({ name }) => name === 'Claxon');
    expect(sound?.blocks.map(({ kind }) => kind)).toEqual(['beep', 'trill']);
    expect(settings.events.find((row) => row.event === 'needs_name')?.soundId).toBe(sound?.id);

    await page.locator('.row.preset', { hasText: 'Claxon' }).getByRole('button', { name: 'Bewerken' }).click();
    await expect(editor.locator('button.danger')).toBeDisabled();
    await expect(editor.locator('button.danger')).toHaveAttribute('title', 'In gebruik');
});
