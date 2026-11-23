import { ProductSuggestion } from '@barcodescanner/shared';

export interface ProductConnector {
    readonly id: string;

    lookup(code: string): Promise<ProductSuggestion | undefined>;
}
