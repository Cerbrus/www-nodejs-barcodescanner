import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    Module,
    Param,
    ParseBoolPipe,
    ParseIntPipe,
    Patch,
    Post,
    Put,
    Query
} from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

import { CatalogService } from './catalog.service';
import { BarcodeEntity, CatalogItemEntity, SectionEntity } from '../data/entities';
import { EventsModule } from '../events/events.module';
import { ScanModule } from '../scan/scan.module';

export class CatalogItemUpdateDto {
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    @MaxLength(80)
    public name?: string;

    @IsOptional()
    @IsString()
    @IsNotEmpty()
    public sectionId?: string;

    @IsOptional()
    @IsString()
    @MaxLength(80)
    public icon?: string;

    @IsOptional()
    @IsString()
    @MaxLength(16)
    public emoji?: string;
}

export class CatalogItemCreateDto extends CatalogItemUpdateDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(80)
    public override name: string;

    @IsString()
    @IsNotEmpty()
    public override sectionId: string;
}

export class BarcodeMappingDto {
    @IsInt()
    public catalogItemId: number;
}

@Controller({ path: 'sections', version: '1' })
export class SectionController {
    constructor(private readonly catalog: CatalogService) {
    }

    @Get()
    public getSections(): Promise<Array<SectionEntity>> {
        return this.catalog.getSections();
    }
}

@Controller({ path: 'catalog', version: '1' })
export class CatalogController {
    constructor(private readonly catalog: CatalogService) {
    }

    @Get()
    public getItems(@Query('search') search?: string): Promise<Array<CatalogItemEntity>> {
        return this.catalog.getItems(search);
    }

    @Get(':id')
    public getItem(@Param('id', ParseIntPipe) id: number): Promise<CatalogItemEntity> {
        return this.catalog.getItem(id);
    }

    @Post()
    public createItem(@Body() item: CatalogItemCreateDto): Promise<CatalogItemEntity> {
        return this.catalog.createItem(item);
    }

    @Patch(':id')
    public updateItem(
        @Param('id', ParseIntPipe) id: number,
        @Body() item: CatalogItemUpdateDto
    ): Promise<CatalogItemEntity> {
        return this.catalog.updateItem(id, item);
    }

    @Delete(':id')
    @HttpCode(204)
    public deleteItem(@Param('id', ParseIntPipe) id: number): Promise<void> {
        return this.catalog.deleteItem(id);
    }
}

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

@Controller({ path: 'icons', version: '1' })
export class IconController {
    constructor(private readonly catalog: CatalogService) {
    }

    @Get()
    public getIconNames(): Promise<Array<string>> {
        return this.catalog.getIconNames();
    }
}

@Module({
    imports: [TypeOrmModule.forFeature([SectionEntity, CatalogItemEntity, BarcodeEntity]), ScanModule, EventsModule],
    controllers: [SectionController, CatalogController, BarcodeController, IconController],
    providers: [CatalogService]
})
export class CatalogModule {
}
