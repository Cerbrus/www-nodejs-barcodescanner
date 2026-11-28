import { ProductSuggestion } from '@barcodescanner/shared';

export interface BarcodeHit {
    code: string;
    suggestion: ProductSuggestion;
    size?: string;
}

export interface ProductConnector {
    readonly id: string;

    lookup(code: string): Promise<ProductSuggestion | undefined>;

    search?(words: string): Promise<Array<BarcodeHit>>;
}
