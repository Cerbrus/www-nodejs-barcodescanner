import { Body, Controller, Delete, Get, HttpCode, Module, Param, ParseIntPipe, Patch } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

import { ListService } from './list.service';
import { CatalogItemEntity, ListEntryEntity, ListState } from '../data/entities';
import { EventsModule } from '../events/events.module';

export class ListEntryChangeDto {
    @IsOptional()
    @IsIn(['to_buy', 'recent'])
    public state?: ListState;

    @IsOptional()
    @IsInt()
    @Min(1)
    public quantity?: number;

    @IsOptional()
    @IsString()
    @MaxLength(200)
    public note?: string;
}

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

@Module({
    imports: [TypeOrmModule.forFeature([ListEntryEntity, CatalogItemEntity]), EventsModule],
    controllers: [ListController],
    providers: [ListService],
    exports: [ListService]
})
export class ListModule {
}
