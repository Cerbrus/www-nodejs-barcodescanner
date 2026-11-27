import {
    IssueProgress,
    ListState,
    ProductSuggestion,
    RecipeIngredient,
    RemarkContext,
    RemarkKind,
    RemarkTarget,
    ScanResult,
    ScanSource,
    Sound,
    SoundStep
} from '@barcodescanner/shared';

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
    draft: boolean;
    defaultIcon?: string;
    recipeCount?: number;
    section?: Section;
    barcodes?: Array<Barcode>;
}

export interface NameProposal {
    catalogItemId?: number;
    name: string;
    note: string;
}

export interface Barcode {
    code: string;
    proposal?: NameProposal;
    catalogItemId?: number;
    catalogItem?: CatalogItem;
    note?: string;
    suggestions?: Array<ProductSuggestion>;
    lookupFailed?: Array<string>;
    scanCount: number;
    lastScannedAt?: string;
}

export interface ListEntry {
    id: string;
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
    note?: string;
    title?: string;
    changes?: Array<ScanChange>;
}

export interface ScanChange {
    catalogItemId: number;
    note: string;
    quantity: number;
}

export interface Recipe {
    id: number;
    name: string;
    description: string;
    ingredients: Array<RecipeIngredient>;
}

export interface RecipeOffer {
    id: number;
    name: string;
    createdAt: string;
    products: number;
    unknown: Array<number>;
    nameTaken: boolean;
}

export interface ScannedRecipeCode {
    code: string;
    save: boolean;
}

export interface RecipeInput {
    name: string;
    description: string;
    ingredients: Array<RecipeIngredient>;
}

export interface ScanOutcome {
    scanId: number;
    code: string;
    result: ScanResult;
    catalogItemId?: number;
    itemName?: string;
    note?: string;
    quantity?: number;
    title?: string;
    added?: number;
    unknown?: Array<number>;
}

export interface LogLine {
    id: number;
    time: string;
    source: 'app' | 'agent' | 'phone';
    level: LogLevel;
    message: string;
}

export interface Release {
    version: string;
    released: string;
    summary: string;
    notes: Array<string>;
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

export interface FeedbackSettings {
    events: Array<{ event: string; soundId: string; steps: Array<SoundStep> }>;
    sounds: Array<Sound>;
}

export interface AuthState {
    enabled: boolean;
    authenticated: boolean;
    owner: boolean;
    email?: string;
}

export interface AgentStatus {
    agentOnline: boolean;
    agentSeenAt?: string;
    scanner?: 'connected' | 'waiting';
    device?: string;
    lastHandheldScanAt?: string;
}

export interface CatalogItemInput {
    name?: string;
    sectionId?: string;
    icon?: string;
    emoji?: string;
}

export interface ListEntryChange {
    catalogItemId?: number;
    state?: ListState;
    quantity?: number;
    note?: string;
}

export interface RemarkInput {
    kind: RemarkKind;
    text: string;
    page: string;
    target?: RemarkTarget;
    context?: RemarkContext;
    writtenAt?: string;
}

export interface Remark {
    id: number;
    kind: RemarkKind;
    text: string;
    state: 'open' | 'closed' | 'rejected';
    page: string;
    target?: RemarkTarget | null;
    context?: RemarkContext | null;
    account: string;
    createdAt: string;
    closedAt?: string | null;
    issueNumber?: number | null;
    issueUrl?: string | null;
    progress?: IssueProgress;
}

export interface RemarkList {
    remarks: Array<Remark>;
    canSendToGitHub: boolean;
}
