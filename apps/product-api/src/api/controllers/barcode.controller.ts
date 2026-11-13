import { Body, Controller, Delete, Get, HttpCode, Param, ParseBoolPipe, Post, Put, Query } from '@nestjs/common';

import { BarcodeService } from '../../core/services/barcode.service';
import { ScanService } from '../../core/services/scan.service';
import { BarcodeEntity } from '../../data/entities';
import { BarcodeMappingDto } from '../dto/barcode-mapping.dto';

@Controller({ path: 'barcodes', version: '1' })
export class BarcodeController {
    constructor(
        private readonly barcodes: BarcodeService,
        private readonly scans: ScanService
    ) {
    }

    @Get()
    public getBarcodes(
        @Query('unmapped', new ParseBoolPipe({ optional: true })) unmapped?: boolean
    ): Promise<Array<BarcodeEntity>> {
        return this.barcodes.getAll(unmapped ?? false);
    }

    @Get(':code')
    public getBarcode(@Param('code') code: string): Promise<BarcodeEntity> {
        return this.barcodes.get(code);
    }

    @Put(':code')
    public mapBarcode(@Param('code') code: string, @Body() mapping: BarcodeMappingDto): Promise<BarcodeEntity> {
        return this.scans.nameBarcode(code, mapping.catalogItemId);
    }

    @Delete(':code')
    @HttpCode(204)
    public unmapBarcode(@Param('code') code: string): Promise<void> {
        return this.barcodes.unlink(code);
    }

    @Post(':code/discard')
    @HttpCode(204)
    public discardBarcode(@Param('code') code: string): Promise<void> {
        return this.scans.discardBarcode(code);
    }
}
