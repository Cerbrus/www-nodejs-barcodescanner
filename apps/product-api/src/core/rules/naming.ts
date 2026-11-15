export interface NamedProduct {
    id: number;
    name: string;
}

export interface ShopTitle {
    title: string;
    brand?: string;
}

export interface NameProposal {
    catalogItemId?: number;
    name: string;
    note: string;
}

interface Match {
    product: NamedProduct;
    size: number;
    start: number;
    length: number;
}

const SHOP_PREFIXES = ['ah', 'ah biologisch', 'ah terra', 'jumbo', 'plus', 'lidl', 'aldi', "g'woon", 'euroshopper'];
const AMOUNT =
    /^(\d+([.,]\d+)?([x×]\d+([.,]\d+)?)?(\+|%|g|gr|gram|kg|ml|cl|dl|l|ltr|liter|st|stuks?)?|[x×]|g|gr|gram|kg|ml|cl|dl|l|ltr|liter|st|stuks?)$/i;

const fold = (text: string): string => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

const words = (text: string): Array<string> =>
    text
        .split(/\s+/)
        .map((word) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}+%']+$/gu, ''))
        .filter((word) => word);

function withoutPrefix(title: Array<string>, prefix: string): Array<string> {
    const parts = words(prefix).map(fold);
    const starts = parts.length && parts.every((part, index) => fold(title[index] ?? '') === part);

    return starts ? title.slice(parts.length) : title;
}

export function cleanTitle({ title, brand }: ShopTitle): Array<string> {
    const prefixes = [...(brand ? [brand] : []), ...SHOP_PREFIXES].sort((a, b) => b.length - a.length);
    const shortened = prefixes.reduce((rest, prefix) => withoutPrefix(rest, prefix), words(title));

    return shortened.filter((word) => !AMOUNT.test(word));
}

function matchIn(title: Array<string>, product: NamedProduct): Match | undefined {
    const name = words(product.name).map(fold);
    const folded = title.map(fold);
    const start = folded.findIndex((_, at) => name.every((part, index) => folded[at + index] === part));

    return name.length && start >= 0 ? { product, size: name.length, start, length: product.name.length } : undefined;
}

const better = (a: Match, b: Match): number => b.size - a.size || b.length - a.length;

const sentence = (parts: Array<string>): string => {
    const text = parts.join(' ');

    return text.charAt(0).toUpperCase() + text.slice(1);
};

export function proposeName(shop: ShopTitle, products: Array<NamedProduct>): NameProposal | undefined {
    const title = cleanTitle(shop);
    if (!title.length) {
        return undefined;
    }

    const [best] = products
        .map((product) => matchIn(title, product))
        .filter((match): match is Match => match !== undefined)
        .sort(better);
    if (!best) {
        return { name: sentence(title), note: '' };
    }

    const rest = [...title.slice(0, best.start), ...title.slice(best.start + best.size)];

    return { catalogItemId: best.product.id, name: best.product.name, note: sentence(rest) };
}

export function proposeFromShops(shops: Array<ShopTitle>, products: Array<NamedProduct>): NameProposal | undefined {
    const proposals = shops
        .map((shop) => proposeName(shop, products))
        .filter((proposal): proposal is NameProposal => proposal !== undefined);

    return (
        proposals.find((proposal) => proposal.catalogItemId && !proposal.note) ??
        proposals.find((proposal) => proposal.catalogItemId) ??
        proposals[0]
    );
}
