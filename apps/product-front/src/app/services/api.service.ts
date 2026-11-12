import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
    Barcode,
    CatalogItem,
    CatalogItemInput,
    Health,
    ListEntry,
    ListEntryChange,
    LogLine,
    Scan,
    ScanOutcome,
    ScanSource,
    Section
} from '../models';
import { SettingsService } from './settings/settings.service';

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

    public getList(): Observable<Array<ListEntry>> {
        return this.http.get<Array<ListEntry>>(`${this.baseUrl}/list`);
    }

    public changeListEntry(catalogItemId: number, change: ListEntryChange): Observable<ListEntry> {
        return this.http.patch<ListEntry>(`${this.baseUrl}/list/${catalogItemId}`, change);
    }

    public getInbox(): Observable<Array<Barcode>> {
        return this.http.get<Array<Barcode>>(`${this.baseUrl}/barcodes`, { params: { unmapped: true } });
    }

    public getBarcode(code: string): Observable<Barcode> {
        return this.http.get<Barcode>(`${this.baseUrl}/barcodes/${code}`);
    }

    public mapBarcode(code: string, catalogItemId: number): Observable<Barcode> {
        return this.http.put<Barcode>(`${this.baseUrl}/barcodes/${code}`, { catalogItemId });
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

    public scan(code: string, source: ScanSource): Observable<ScanOutcome> {
        return this.http.post<ScanOutcome>(`${this.baseUrl}/scans`, { code, source });
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
}
