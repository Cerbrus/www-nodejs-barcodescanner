import { ProductSuggestion } from '../../data/entities';

export { ProductSuggestion };

export interface ProductConnector {
    readonly id: string;

    lookup(code: string): Promise<ProductSuggestion | undefined>;
}
