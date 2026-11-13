import { Body, Controller, Delete, Get, HttpCode, Param, ParseBoolPipe, Post, Put, Query } from '@nestjs/common';

import { CatalogService } from '../../core/services/catalog.service';
import { BarcodeEntity } from '../../data/entities';
import { BarcodeMappingDto } from '../dto/barcode-mapping.dto';

@Controller({ path: 'barcodes', version: '1' })
export class BarcodeController {
    constructor(private readonly catalog: CatalogService) {
    }

    @Get()
    public getBarcodes(
        @Query('unmapped', new ParseBoolPipe({ optional: true })) unmapped?: boolean
    ): Promise<Array<BarcodeEntity>> {
        return this.catalog.getBarcodes(unmapped ?? false);
    }

    @Get(':code')
    public getBarcode(@Param('code') code: string): Promise<BarcodeEntity> {
        return this.catalog.getBarcode(code);
    }

    @Put(':code')
    public mapBarcode(@Param('code') code: string, @Body() mapping: BarcodeMappingDto): Promise<BarcodeEntity> {
        return this.catalog.mapBarcode(code, mapping.catalogItemId);
    }

    @Delete(':code')
    @HttpCode(204)
    public unmapBarcode(@Param('code') code: string): Promise<void> {
        return this.catalog.unmapBarcode(code);
    }

    @Post(':code/discard')
    @HttpCode(204)
    public discardBarcode(@Param('code') code: string): Promise<void> {
        return this.catalog.discardBarcode(code);
    }
}
