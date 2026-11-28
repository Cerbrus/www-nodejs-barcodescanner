import { Injectable } from '@nestjs/common';

import { ProductSuggestion } from '@barcodescanner/shared';

import { brandName } from '../rules/barcode-search';
import { BarcodeHit, ProductConnector } from './connector.model';

const PRODUCT_URL = 'https://world.openfoodfacts.org/api/v2/product';
const FIELDS = 'product_name,product_name_nl,brands,categories_tags,image_front_small_url';
const SEARCH_URL = 'https://search.openfoodfacts.org/search';
const SEARCH_FIELDS = 'code,product_name,brands,quantity';
const SEARCH_COUNTRY = 'countries:"en:netherlands"';
const SEARCH_HITS = 10;
const TIMEOUT_MILLISECONDS = 5000;
const USER_AGENT = 'home-barcode-scanner/1.0';

interface OpenFoodFactsResponse {
    status: number;
    product?: {
        product_name?: string;
        product_name_nl?: string;
        brands?: string;
        categories_tags?: Array<string>;
        image_front_small_url?: string;
    };
}

interface OpenFoodFactsSearchResponse {
    hits?: Array<{
        code?: string;
        product_name?: string;
        brands?: Array<string> | string;
        quantity?: string;
    }>;
}

@Injectable()
export class OpenFoodFactsConnector implements ProductConnector {
    public readonly id = 'off';

    public async lookup(code: string): Promise<ProductSuggestion | undefined> {
        const response = await fetch(`${PRODUCT_URL}/${encodeURIComponent(code)}?fields=${FIELDS}`, {
            headers: { 'user-agent': USER_AGENT },
            signal: AbortSignal.timeout(TIMEOUT_MILLISECONDS)
        });

        if (response.status === 404) {
            return undefined;
        }
        if (!response.ok) {
            throw new Error(`Open Food Facts answered ${response.status}`);
        }

        const { status, product } = (await response.json()) as OpenFoodFactsResponse;
        const title = product?.product_name_nl || product?.product_name;
        if (status !== 1 || !product || !title) {
            return undefined;
        }

        return {
            connectorId: this.id,
            title,
            brand: product.brands || undefined,
            category: product.categories_tags
                ?.at(-1)
                ?.replace(/^[a-z]{2}:/, '')
                .replace(/-/g, ' '),
            imageUrl: product.image_front_small_url
        };
    }

    public async search(words: string): Promise<Array<BarcodeHit>> {
        const query = new URLSearchParams({
            q: `${words} ${SEARCH_COUNTRY}`,
            langs: 'nl',
            page_size: String(SEARCH_HITS),
            fields: SEARCH_FIELDS
        });
        const response = await fetch(`${SEARCH_URL}?${query}`, {
            headers: { 'user-agent': USER_AGENT },
            signal: AbortSignal.timeout(TIMEOUT_MILLISECONDS)
        });
        if (!response.ok) {
            throw new Error(`Open Food Facts search answered ${response.status}`);
        }

        const { hits } = (await response.json()) as OpenFoodFactsSearchResponse;

        return (hits ?? []).flatMap(({ code, product_name: title, brands, quantity }) =>
            code && title
                ? [
                      {
                          code,
                          suggestion: { connectorId: this.id, title, brand: brandName(brands) },
                          size: quantity || undefined
                      }
                  ]
                : []
        );
    }
}
