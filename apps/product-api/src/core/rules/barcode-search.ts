import { NamedProduct, ShopTitle, proposeName } from './naming';

export interface CodedHit {
    code: string;
}

const BARCODE = /^\d{6,14}$/;
const PACKAGE_LENGTHS = [8, 13];

export const isShopCode = (code: string): boolean => /^(00|2)/.test(code) || !PACKAGE_LENGTHS.includes(code.length);

export function orderHits<T extends CodedHit>(hits: Array<T>): Array<T> {
    const seen = new Set<string>();
    const unique = hits.filter(({ code }) => BARCODE.test(code) && !seen.has(code) && seen.add(code));

    return [...unique.filter(({ code }) => !isShopCode(code)), ...unique.filter(({ code }) => isShopCode(code))];
}

export const brandName = (tags: Array<string> | string | undefined): string | undefined =>
    [tags ?? []]
        .flat()
        .map((tag) =>
            tag
                .replace(/^[a-z]{2}:/, '')
                .replace(/-/g, ' ')
                .trim()
        )
        .filter((tag) => tag)
        .join(', ') || undefined;

export const searchWords = (words: string): string =>
    words
        .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();

export function variantFor(shops: Array<ShopTitle>, product: NamedProduct): string {
    const notes = shops.flatMap((shop) => {
        const proposal = proposeName(shop, [product]);

        return proposal?.catalogItemId ? [proposal.note] : [];
    });

    return notes.find((note) => note) ?? '';
}
