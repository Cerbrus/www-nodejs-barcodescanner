import { APIRequestContext, Locator, Page, expect } from '@playwright/test';

export interface CatalogItem {
    id: number;
    name: string;
}

export interface ListEntry {
    catalogItemId: number;
    catalogItem: CatalogItem;
    state: 'to_buy' | 'recent';
}

export const TYPED_CODE = '8710400990024';

export const listOf = async (request: APIRequestContext): Promise<Array<ListEntry>> => (await request.get('/api/v1/list')).json();
export const productOffTheList = async (request: APIRequestContext): Promise<CatalogItem> => {
    const catalog = (await (await request.get('/api/v1/catalog')).json()) as Array<CatalogItem>;
    const listed = new Set((await listOf(request)).map((entry) => entry.catalogItemId));
    const names = catalog.map((item) => item.name.toLowerCase());

    return catalog.find((item) => !listed.has(item.id) && names.filter((name) => name.includes(item.name.toLowerCase())).length === 1) as CatalogItem;
};
export const tile = (page: Page, tone: 'buy' | 'recent', name: string): Locator =>
    page.locator(`app-item-tile:has(button.tile.${tone})`).filter({ has: page.locator('.name', { hasText: new RegExp(`^${name}$`) }) });
export const nameInPrompt = async (page: Page, name: string): Promise<void> => {
    const prompt = page.locator('app-naming-prompt');
    await expect(prompt.locator('.sheet')).toBeVisible();
    await prompt.locator('app-item-autocomplete input').fill(name);
    await prompt.locator('app-item-autocomplete .option').first().click();
    await expect(prompt).toHaveCount(0);
};
