import { Body, Controller, DefaultValuePipe, Get, ParseIntPipe, Post, Query } from '@nestjs/common';

import { ScanOutcome, ScanService } from '../../core/services/scan.service';
import { ScanEntity } from '../../data/entities';
import { ScanDto } from '../dto/scan.dto';
import { Agent } from '../guards/agent.decorator';
import { CalledBy } from '../guards/caller.decorator';
import { Caller } from '../http';

const MAX_HISTORY = 500;

@Controller({ path: 'scans', version: '1' })
export class ScanController {
    constructor(private readonly scans: ScanService) {
    }

    @Agent()
    @Post()
    public register(@Body() scan: ScanDto, @CalledBy() caller: Caller): Promise<ScanOutcome> {
        return this.scans.register(scan.code, caller === 'agent' ? 'handheld' : 'phone');
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
