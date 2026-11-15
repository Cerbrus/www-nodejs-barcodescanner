import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';

import { ListService, OfflineResult } from '../../core/services/list.service';
import { ListEntryEntity } from '../../data/entities';
import { ListEntryChangeDto } from '../dto/list-entry-change.dto';
import { ENTRY_ID, OfflineChangesDto } from '../dto/offline-changes.dto';

function entryId(id: string): string {
    if (!ENTRY_ID.test(id)) {
        throw new BadRequestException('Not a list entry id');
    }

    return id;
}

@Controller({ path: 'list', version: '1' })
export class ListController {
    constructor(private readonly list: ListService) {}

    @Get()
    public getEntries(): Promise<Array<ListEntryEntity>> {
        return this.list.getEntries();
    }

    @Post('offline-changes')
    @HttpCode(200)
    public applyOffline(@Body() body: OfflineChangesDto): Promise<OfflineResult> {
        return this.list.applyOffline(
            body.changes.map(({ changedAt, ...change }) => ({ ...change, changedAt: new Date(changedAt) }))
        );
    }

    @Patch(':id')
    public change(@Param('id') id: string, @Body() change: ListEntryChangeDto): Promise<ListEntryEntity> {
        return this.list.change(entryId(id), change);
    }

    @Delete(':id')
    @HttpCode(204)
    public remove(@Param('id') id: string): Promise<void> {
        return this.list.remove(entryId(id));
    }
}
