import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { IssueDraft, IssueOptions, RecipeContent, RemarkKind, SoundBlock } from '@barcodescanner/shared';

import {
    AgentStatus,
    Barcode,
    CatalogItem,
    CatalogItemInput,
    FeedbackSettings,
    Health,
    ListEntry,
    ListEntryChange,
    LogLine,
    PushResult,
    PushSubscriptionInput,
    Recipe,
    RecipeInput,
    RecipeOffer,
    Release,
    Remark,
    RemarkInput,
    RemarkList,
    Scan,
    ScanOutcome,
    ScannedRecipeCode,
    Section
} from '../models';
import { FAILURE_TEXTS, QUIET_FAILURE, QUIET_WITHOUT_CONNECTION } from './failed-change.interceptor';
import { PendingChange } from './outbox';
import { SettingsService } from './settings/settings.service';

const REMARK_FAILURES = new HttpContext().set(FAILURE_TEXTS, {
    409: 'remark.error.alreadyOnGitHub',
    502: 'remark.error.gitHubFailed',
    503: 'remark.error.gitHubOff'
});
const QUIET = new HttpContext().set(QUIET_FAILURE, true);
const QUEUED_WITHOUT_CONNECTION = new HttpContext().set(QUIET_WITHOUT_CONNECTION, true);

@Injectable({ providedIn: 'root' })
export class ApiService {
    private readonly http = inject(HttpClient);
    private readonly settings = inject(SettingsService);

    public get baseUrl(): string {
        return `${this.settings.getApiUrl('core')}/v1`;
    }

    public get iconsUrl(): string {
        return `${this.settings.getApiUrl('core').replace(/\/api$/, '')}/icons`;
    }

    public getAgentStatus(): Observable<AgentStatus> {
        return this.http.get<AgentStatus>(`${this.baseUrl}/agent/status`);
    }

    public getChangelog(): Observable<Array<Release>> {
        return this.http.get<Array<Release>>('assets/changelog.json');
    }

    public getHealth(): Observable<Health> {
        return this.http.get<Health>(`${this.baseUrl}/health`);
    }

    public getSections(): Observable<Array<Section>> {
        return this.http.get<Array<Section>>(`${this.baseUrl}/sections`);
    }

    public getCatalog(): Observable<Array<CatalogItem>> {
        return this.http.get<Array<CatalogItem>>(`${this.baseUrl}/catalog`);
    }

    public getCatalogItem(id: number): Observable<CatalogItem> {
        return this.http.get<CatalogItem>(`${this.baseUrl}/catalog/${id}`);
    }

    public createCatalogItem(item: CatalogItemInput): Observable<CatalogItem> {
        return this.http.post<CatalogItem>(`${this.baseUrl}/catalog`, item);
    }

    public updateCatalogItem(id: number, item: CatalogItemInput): Observable<CatalogItem> {
        return this.http.patch<CatalogItem>(`${this.baseUrl}/catalog/${id}`, item);
    }

    public deleteCatalogItem(id: number): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}/catalog/${id}`);
    }

    public confirmDraft(id: number): Observable<CatalogItem> {
        return this.http.post<CatalogItem>(`${this.baseUrl}/catalog/${id}/confirmation`, {});
    }

    public replaceDraft(id: number, catalogItemId: number): Observable<void> {
        return this.http.post<void>(`${this.baseUrl}/catalog/${id}/replacement`, { catalogItemId });
    }

    public getList(): Observable<Array<ListEntry>> {
        return this.http.get<Array<ListEntry>>(`${this.baseUrl}/list`);
    }

    public changeListEntry(id: string, change: ListEntryChange): Observable<ListEntry> {
        return this.http.patch<ListEntry>(`${this.baseUrl}/list/${id}`, change, {
            context: QUEUED_WITHOUT_CONNECTION
        });
    }

    public sendOfflineChanges(changes: Array<PendingChange>): Observable<{ applied: number; skipped: Array<string> }> {
        return this.http.post<{ applied: number; skipped: Array<string> }>(
            `${this.baseUrl}/list/offline-changes`,
            { changes },
            { context: QUIET }
        );
    }

    public removeListEntry(id: string): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}/list/${id}`);
    }

    public getRecipes(): Observable<Array<Recipe>> {
        return this.http.get<Array<Recipe>>(`${this.baseUrl}/recipes`);
    }

    public createRecipe(recipe: RecipeInput): Observable<Recipe> {
        return this.http.post<Recipe>(`${this.baseUrl}/recipes`, recipe);
    }

    public updateRecipe(id: number, recipe: RecipeInput): Observable<Recipe> {
        return this.http.patch<Recipe>(`${this.baseUrl}/recipes/${id}`, recipe);
    }

    public deleteRecipe(id: number): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}/recipes/${id}`);
    }

    public getRecipeOffers(): Observable<Array<RecipeOffer>> {
        return this.http.get<Array<RecipeOffer>>(`${this.baseUrl}/recipes/offers`);
    }

    public saveRecipeOffer(id: number): Observable<Recipe> {
        return this.http.post<Recipe>(`${this.baseUrl}/recipes/offers/${id}/save`, {});
    }

    public dropRecipeOffer(id: number): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}/recipes/offers/${id}`);
    }

    public addRecipe(recipe: RecipeContent, scanned?: ScannedRecipeCode, addedAt?: string): Observable<ScanOutcome> {
        return this.http.post<ScanOutcome>(`${this.baseUrl}/recipes/additions`, { ...recipe, ...scanned, addedAt });
    }

    public getInbox(): Observable<Array<Barcode>> {
        return this.http.get<Array<Barcode>>(`${this.baseUrl}/barcodes`, { params: { unmapped: true } });
    }

    public getBarcode(code: string): Observable<Barcode> {
        return this.http.get<Barcode>(`${this.baseUrl}/barcodes/${code}`);
    }

    public mapBarcode(code: string, catalogItemId: number, note = ''): Observable<Barcode> {
        return this.http.put<Barcode>(`${this.baseUrl}/barcodes/${code}`, { catalogItemId, note });
    }

    public repeatLookup(code: string): Observable<Barcode> {
        return this.http.post<Barcode>(`${this.baseUrl}/barcodes/${code}/lookup`, {});
    }

    public unmapBarcode(code: string): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}/barcodes/${code}`);
    }

    public discardBarcode(code: string): Observable<void> {
        return this.http.post<void>(`${this.baseUrl}/barcodes/${code}/discard`, {});
    }

    public getIcons(): Observable<Array<string>> {
        return this.http.get<Array<string>>(`${this.baseUrl}/icons`);
    }

    public scan(code: string, collecting = false): Observable<ScanOutcome> {
        return this.http.post<ScanOutcome>(`${this.baseUrl}/scans`, { code, collecting }, { context: QUIET });
    }

    public undoScan(): Observable<{ undone?: Scan }> {
        return this.http.post<{ undone?: Scan }>(`${this.baseUrl}/scans/undo`, {});
    }

    public getScans(limit = 100): Observable<Array<Scan>> {
        return this.http.get<Array<Scan>>(`${this.baseUrl}/scans`, { params: { limit } });
    }

    public getLogs(limit = 300): Observable<Array<LogLine>> {
        return this.http.get<Array<LogLine>>(`${this.baseUrl}/logs`, { params: { limit } });
    }

    public getPushKey(): Observable<{ publicKey: string }> {
        return this.http.get<{ publicKey: string }>(`${this.baseUrl}/push/key`);
    }

    public savePushSubscription(subscription: PushSubscriptionInput): Observable<void> {
        return this.http.post<void>(`${this.baseUrl}/push/subscriptions`, subscription, { context: QUIET });
    }

    public deletePushSubscription(endpoint: string): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}/push/subscriptions`, { body: { endpoint } });
    }

    public sendTestPush(): Observable<PushResult> {
        return this.http.post<PushResult>(`${this.baseUrl}/push/test`, {});
    }

    public getFeedbackSettings(): Observable<FeedbackSettings> {
        return this.http.get<FeedbackSettings>(`${this.baseUrl}/feedback/settings`);
    }

    public setFeedbackSound(event: string, soundId: string): Observable<FeedbackSettings> {
        return this.http.put<FeedbackSettings>(`${this.baseUrl}/feedback/settings/${event}`, { soundId });
    }

    public testSound(soundId: string): Observable<void> {
        return this.http.post<void>(`${this.baseUrl}/feedback/test`, { soundId });
    }

    public testSoundBlocks(blocks: Array<SoundBlock>): Observable<void> {
        return this.http.post<void>(`${this.baseUrl}/feedback/test-blocks`, { blocks });
    }

    public createSound(name: string, blocks: Array<SoundBlock>): Observable<FeedbackSettings> {
        return this.http.post<FeedbackSettings>(`${this.baseUrl}/feedback/sounds`, { name, blocks });
    }

    public changeSound(id: string, name: string | undefined, blocks: Array<SoundBlock>): Observable<FeedbackSettings> {
        return this.http.put<FeedbackSettings>(`${this.baseUrl}/feedback/sounds/${id}`, { name, blocks });
    }

    public deleteSound(id: string): Observable<FeedbackSettings> {
        return this.http.delete<FeedbackSettings>(`${this.baseUrl}/feedback/sounds/${id}`);
    }

    public sendRemark(remark: RemarkInput): Observable<{ id: number }> {
        return this.http.post<{ id: number }>(`${this.baseUrl}/remarks`, remark, {
            context: QUEUED_WITHOUT_CONNECTION
        });
    }

    public getRemarks(): Observable<RemarkList> {
        return this.http.get<RemarkList>(`${this.baseUrl}/remarks`);
    }

    public setRemarkState(id: number, state: Remark['state']): Observable<Remark> {
        return this.http.patch<Remark>(`${this.baseUrl}/remarks/${id}`, { state });
    }

    public editRemark(id: number, text: string, kind: RemarkKind): Observable<Remark> {
        return this.http.put<Remark>(
            `${this.baseUrl}/remarks/${id}`,
            { text, kind },
            {
                context: REMARK_FAILURES
            }
        );
    }

    public rejectRemark(id: number): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}/remarks/${id}`, { context: REMARK_FAILURES });
    }

    public getIssueDraft(id: number, options: IssueOptions): Observable<IssueDraft> {
        return this.http.post<IssueDraft>(`${this.baseUrl}/remarks/${id}/issue-draft`, options);
    }

    public sendRemarkToGitHub(id: number, options: IssueOptions): Observable<Remark> {
        return this.http.post<Remark>(`${this.baseUrl}/remarks/${id}/issue`, options, { context: REMARK_FAILURES });
    }
}
