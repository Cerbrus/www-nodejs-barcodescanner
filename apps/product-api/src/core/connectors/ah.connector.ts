import { Injectable } from '@nestjs/common';

import { AHProduct } from './ah';
import { ProductConnector, ProductSuggestion } from './connector.model';

const AUTH_URL = 'https://api.ah.nl/mobile-auth/v1/auth/token/anonymous';
const PRODUCT_URL = 'https://api.ah.nl/mobile-services/product/search/v1/gtin';
const TIMEOUT_MILLISECONDS = 5000;
const TOKEN_MARGIN_MILLISECONDS = 60000;
const HEADERS = {
    'x-application': 'AHWEBSHOP',
    'user-agent': 'Appie/8.8.2 Model/phone Android/7.0-API24',
    'content-type': 'application/json; charset=UTF-8'
};

interface AccessTokenResponse {
    access_token: string;
    expires_in: number;
}

@Injectable()
export class AHConnector implements ProductConnector {
    public readonly id = 'ah';

    private token?: { value: string; expiresAt: number };

    public async lookup(code: string): Promise<ProductSuggestion | undefined> {
        const response = await fetch(`${PRODUCT_URL}/${encodeURIComponent(code)}`, {
            headers: { ...HEADERS, authorization: `Bearer ${await this.getToken()}` },
            signal: AbortSignal.timeout(TIMEOUT_MILLISECONDS)
        });

        if (response.status === 404) {
            return undefined;
        }
        if (!response.ok) {
            throw new Error(`Albert Heijn answered ${response.status}`);
        }

        const product = (await response.json()) as AHProduct;
        if (!product?.title) {
            return undefined;
        }

        return {
            connectorId: this.id,
            title: product.title,
            brand: product.brand,
            category: product.mainCategory,
            imageUrl: product.images?.[0]?.url
        };
    }

    private async getToken(): Promise<string> {
        if (this.token && this.token.expiresAt > Date.now()) {
            return this.token.value;
        }

        const response = await fetch(AUTH_URL, {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify({ clientId: 'appie' }),
            signal: AbortSignal.timeout(TIMEOUT_MILLISECONDS)
        });
        if (!response.ok) {
            throw new Error(`Albert Heijn token request answered ${response.status}`);
        }

        const token = (await response.json()) as AccessTokenResponse;
        this.token = {
            value: token.access_token,
            expiresAt: Date.now() + token.expires_in * 1000 - TOKEN_MARGIN_MILLISECONDS
        };

        return this.token.value;
    }
}
