import { Body, Controller, DefaultValuePipe, Get, Module, ParseIntPipe, Post, Query } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IsIn, IsString, Matches } from 'class-validator';

import { ScanOutcome, ScanService } from './scan.service';
import { ConnectorsModule } from '../connectors/connectors.module';
import { BarcodeEntity, ScanEntity, ScanSource } from '../data/entities';
import { EventsModule } from '../events/events.module';
import { ListModule } from '../list/list.module';
import { PushModule } from '../push/push.module';

const MAX_HISTORY = 500;

export class ScanDto {
    @IsString()
    @Matches(/^\d{6,14}$/)
    public code: string;

    @IsIn(['handheld', 'phone'])
    public source: ScanSource;
}

@Controller({ path: 'scans', version: '1' })
export class ScanController {
    constructor(private readonly scans: ScanService) {
    }

    @Post()
    public register(@Body() scan: ScanDto): Promise<ScanOutcome> {
        return this.scans.register(scan.code, scan.source);
    }

    @Post('undo')
    public async undo(): Promise<{ undone: ScanEntity | null }> {
        return { undone: (await this.scans.undo()) ?? null };
    }

    @Get()
    public history(@Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number): Promise<Array<ScanEntity>> {
        return this.scans.history(Math.min(Math.max(limit, 1), MAX_HISTORY));
    }
}

@Module({
    imports: [TypeOrmModule.forFeature([ScanEntity, BarcodeEntity]), ListModule, ConnectorsModule, EventsModule, PushModule],
    controllers: [ScanController],
    providers: [ScanService],
    exports: [ScanService]
})
export class ScanModule {
}
