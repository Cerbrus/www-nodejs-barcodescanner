import { Injectable } from '@nestjs/common';

import { BarcodeEntity } from '../../data/entities';
import { NameProposal, proposeFromShops } from '../rules/naming';
import { BarcodeService } from './barcode.service';
import { CatalogService } from './catalog.service';

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

        const proposal = proposeFromShops(
            barcode.suggestions,
            (await this.catalog.getItems()).filter(({ draft }) => !draft)
        );

        return proposal ? { ...barcode, proposal } : barcode;
    }
}
