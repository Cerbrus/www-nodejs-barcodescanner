import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';

import { CatalogService } from '../../core/services/catalog.service';
import { CatalogItemEntity } from '../../data/entities';
import { CatalogItemCreateDto, CatalogItemUpdateDto } from '../dto/catalog-item.dto';

@Controller({ path: 'catalog', version: '1' })
export class CatalogController {
    constructor(private readonly catalog: CatalogService) {
    }

    @Get()
    public getItems(@Query('search') search?: string): Promise<Array<CatalogItemEntity>> {
        return this.catalog.getItems(search);
    }

    @Get(':id')
    public async getItem(@Param('id', ParseIntPipe) id: number): Promise<CatalogItemEntity & { defaultIcon?: string }> {
        const item = await this.catalog.getItem(id);
        return { ...item, defaultIcon: this.catalog.defaultIcon(item.name) };
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
