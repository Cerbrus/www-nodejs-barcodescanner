import { Controller, Get, Query } from '@nestjs/common';

import { BarcodeCandidate } from '@barcodescanner/shared';

import { BarcodeSearchService } from '../../core/services/barcode-search.service';
import { BarcodeSearchDto } from '../dto/barcode-search.dto';

@Controller({ path: 'barcode-candidates', version: '1' })
export class BarcodeCandidateController {
    constructor(private readonly search: BarcodeSearchService) {}

    @Get()
    public getCandidates(@Query() { query, catalogItemId }: BarcodeSearchDto): Promise<Array<BarcodeCandidate>> {
        return this.search.search(query, catalogItemId);
    }
}
