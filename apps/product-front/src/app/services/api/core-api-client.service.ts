import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { Observable } from 'rxjs';
import { SettingsService } from '../settings/settings.service';
import { BaseApiClient } from './base-api-client';
import { BarcodeDto } from './dto';

@Injectable({
    providedIn: 'root'
})
export class CoreApiClient extends BaseApiClient {
    constructor(httpService: HttpClient, settings: SettingsService) {
        super(httpService, settings, 'core');
    }

    public createBarcode(): Observable<BarcodeDto> {
        return this.post<BarcodeDto>('/poll', {});
    }


    public getBarcode(barcode: string): Observable<BarcodeDto> {
        return this.get<BarcodeDto>(`/barcode/${barcode}`);
    }

    public getBarcodes(): Observable<Array<BarcodeDto>> {
        return this.get<Array<BarcodeDto>>(`/barcode/test-connectors`);
    }

}
