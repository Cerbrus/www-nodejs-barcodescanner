import { Body, Controller, Delete, Get, HttpCode, Param, ParseBoolPipe, Post, Put, Query } from '@nestjs/common';

import { BarcodeService } from '../../core/services/barcode.service';
import { BarcodeWithProposal, NamingService } from '../../core/services/naming.service';
import { ScanService } from '../../core/services/scan.service';
import { BarcodeEntity } from '../../data/entities';
import { BarcodeMappingDto } from '../dto/barcode-mapping.dto';

@Controller({ path: 'barcodes', version: '1' })
export class BarcodeController {
    constructor(
        private readonly barcodes: BarcodeService,
        private readonly naming: NamingService,
        private readonly scans: ScanService
    ) {}

    @Get()
    public getBarcodes(
        @Query('unmapped', new ParseBoolPipe({ optional: true })) unmapped?: boolean
    ): Promise<Array<BarcodeEntity>> {
        return this.barcodes.getAll(unmapped ?? false);
    }

    @Get(':code')
    public getBarcode(@Param('code') code: string): Promise<BarcodeWithProposal> {
        return this.naming.getWithProposal(code);
    }

    @Put(':code')
    public mapBarcode(@Param('code') code: string, @Body() mapping: BarcodeMappingDto): Promise<BarcodeEntity> {
        return this.scans.nameBarcode(code, mapping.catalogItemId, mapping.note);
    }

    @Delete(':code')
    @HttpCode(204)
    public unmapBarcode(@Param('code') code: string): Promise<void> {
        return this.barcodes.unlink(code);
    }

    @Post(':code/lookup')
    @HttpCode(200)
    public repeatLookup(@Param('code') code: string): Promise<BarcodeEntity> {
        return this.scans.repeatLookup(code);
    }

    @Post(':code/discard')
    @HttpCode(204)
    public discardBarcode(@Param('code') code: string): Promise<void> {
        return this.scans.discardBarcode(code);
    }
}
