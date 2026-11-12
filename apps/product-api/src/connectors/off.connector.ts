import { Injectable } from '@nestjs/common';

import { ProductConnector, ProductSuggestion } from './connector.model';

const PRODUCT_URL = 'https://world.openfoodfacts.org/api/v2/product';
const FIELDS = 'product_name,product_name_nl,brands,categories_tags,image_front_small_url';
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
            category: product.categories_tags?.at(-1)?.replace(/^[a-z]{2}:/, '').replace(/-/g, ' '),
            imageUrl: product.image_front_small_url
        };
    }
}
