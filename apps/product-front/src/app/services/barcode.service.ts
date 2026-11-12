import { Injectable } from '@angular/core';
import { CoreApiClient } from './api/core-api-client.service';
import { Observable } from 'rxjs';
import { BarcodeDto } from './api/dto';

@Injectable({
    providedIn: 'root'
})
export class BarcodeService {
    constructor(private readonly coreApiClient: CoreApiClient) {
    }

    public getBarcodes(): Observable<Array<BarcodeDto>> {
        return this.coreApiClient.getBarcodes();
    }

    public getBarcode(barcode: string): Observable<BarcodeDto> {
        return this.coreApiClient.getBarcode(barcode);
    }
}
