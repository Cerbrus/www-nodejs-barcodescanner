export type ListState = 'to_buy' | 'recent';
export type ScanResult = 'added' | 'incremented' | 'needs_name' | 'ignored';
export type ScanSource = 'handheld' | 'phone';
export type LogLevel = 'debug' | 'info' | 'warning' | 'error';

export interface Section {
    id: string;
    name: string;
    sortOrder: number;
    emoji?: string;
}

export interface CatalogItem {
    id: number;
    name: string;
    sectionId: string;
    icon?: string;
    emoji?: string;
    custom: boolean;
    defaultIcon?: string;
    section?: Section;
    barcodes?: Array<Barcode>;
}

export interface ProductSuggestion {
    connectorId: string;
    title: string;
    brand?: string;
    category?: string;
    imageUrl?: string;
}

export interface Barcode {
    code: string;
    catalogItemId?: number;
    catalogItem?: CatalogItem;
    suggestions?: Array<ProductSuggestion>;
    scanCount: number;
    lastScannedAt?: string;
}

export interface ListEntry {
    catalogItemId: number;
    catalogItem: CatalogItem;
    state: ListState;
    quantity: number;
    note: string;
    updatedAt: string;
}

export interface Scan {
    id: number;
    code: string;
    source: ScanSource;
    result: ScanResult;
    createdAt: string;
    undoneAt?: string;
    catalogItemId?: number;
}

export interface ScanOutcome {
    scanId: number;
    code: string;
    result: ScanResult;
    catalogItemId?: number;
    itemName?: string;
    quantity?: number;
}

export interface LogLine {
    id: number;
    time: string;
    source: 'app' | 'agent';
    level: LogLevel;
    message: string;
}

export interface Health {
    status: string;
    version: string;
    commit?: string;
    builtAt?: string;
}

export interface PushSubscriptionInput {
    endpoint: string;
    p256dh?: string;
    auth?: string;
    language?: string;
    origin?: string;
}

export interface PushResult {
    sent: number;
    failed: number;
}

export interface CatalogItemInput {
    name?: string;
    sectionId?: string;
    icon?: string;
    emoji?: string;
}

export interface ListEntryChange {
    state?: ListState;
    quantity?: number;
    note?: string;
}
