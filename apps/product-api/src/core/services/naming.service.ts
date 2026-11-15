import { Injectable } from '@nestjs/common';

import { BarcodeService } from './barcode.service';
import { CatalogService } from './catalog.service';
import { BarcodeEntity } from '../../data/entities';
import { NameProposal, proposeFromShops } from '../rules/naming';

export interface BarcodeWithProposal extends BarcodeEntity {
    proposal?: NameProposal;
}

@Injectable()
export class NamingService {
    constructor(
        private readonly barcodes: BarcodeService,
        private readonly catalog: CatalogService
    ) {}

    public async getWithProposal(code: string): Promise<BarcodeWithProposal> {
        const barcode = await this.barcodes.get(code);
        if (barcode.catalogItemId || !barcode.suggestions?.length) {
            return barcode;
        }

        const proposal = proposeFromShops(barcode.suggestions, await this.catalog.getItems());

        return proposal ? { ...barcode, proposal } : barcode;
    }
}
