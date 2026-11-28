import { ProductSuggestion } from './product-suggestion';

export const BARCODE_SEARCH_MAX = 80;

export interface BarcodeCandidate {
    code: string;
    suggestions: Array<ProductSuggestion>;
    size?: string;
    note: string;
    shopCode: boolean;
    catalogItem?: { id: number; name: string };
}
