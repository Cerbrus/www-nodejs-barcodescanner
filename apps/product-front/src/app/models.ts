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
    sectionId?: string;
    imageUrl?: string;
}

export interface Barcode {
    code: string;
    catalogItemId?: number;
    catalogItem?: CatalogItem;
    suggestions?: Array<ProductSuggestion>;
    lookupFailed?: Array<string>;
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

export interface SoundStep {
    kind: 'on' | 'off' | 'gate';
    seconds: number;
    hz?: number;
    duty?: number;
}

export interface Sound {
    id: string;
    steps: Array<SoundStep>;
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
    state?: ListState;
    quantity?: number;
    note?: string;
}

export const REMARK_KINDS = ['bug', 'wish', 'note'] as const;
export type RemarkKind = (typeof REMARK_KINDS)[number];

export interface RemarkTarget {
    component?: string;
    label?: string;
    text?: string;
    path?: string;
}

export interface RemarkContext {
    version?: string;
    commit?: string;
    userAgent?: string;
    viewport?: string;
    language?: string;
    theme?: string;
    installed?: boolean;
    online?: boolean;
    waitingChanges?: number;
    recentMessages?: Array<string>;
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
}

export interface RemarkList {
    remarks: Array<Remark>;
    canSendToGitHub: boolean;
}

export interface IssueOptions {
    includeDevice: boolean;
    includeAccount: boolean;
    investigate: boolean;
}

export interface IssueDraft {
    title: string;
    body: string;
    labels: Array<string>;
}
