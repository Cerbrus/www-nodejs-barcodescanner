import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch } from '@nestjs/common';

import { ListService } from '../../core/services/list.service';
import { ListEntryEntity } from '../../data/entities';
import { ListEntryChangeDto } from '../dto/list-entry-change.dto';

@Controller({ path: 'list', version: '1' })
export class ListController {
    constructor(private readonly list: ListService) {
    }

    @Get()
    public getEntries(): Promise<Array<ListEntryEntity>> {
        return this.list.getEntries();
    }

    @Patch(':catalogItemId')
    public change(
        @Param('catalogItemId', ParseIntPipe) catalogItemId: number,
        @Body() change: ListEntryChangeDto
    ): Promise<ListEntryEntity> {
        return this.list.change(catalogItemId, change);
    }

    @Delete(':catalogItemId')
    @HttpCode(204)
    public remove(@Param('catalogItemId', ParseIntPipe) catalogItemId: number): Promise<void> {
        return this.list.remove(catalogItemId);
    }
}
