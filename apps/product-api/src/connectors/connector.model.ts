export interface ProductSuggestion {
    connectorId: string;
    title: string;
    brand?: string;
    category?: string;
    imageUrl?: string;
}

export interface ProductConnector {
    readonly id: string;

    lookup(code: string): Promise<ProductSuggestion | undefined>;
}
