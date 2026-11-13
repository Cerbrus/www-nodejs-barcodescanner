import { Body, Controller, DefaultValuePipe, Get, HttpCode, ParseIntPipe, Post, Query } from '@nestjs/common';

import { LogLine, LogService } from '../../core/services/log.service';
import { LogLineDto } from '../dto/log-line.dto';
import { Agent } from '../guards/agent.decorator';
import { CalledBy } from '../guards/caller.decorator';
import { OwnerOnly } from '../guards/owner.decorator';
import { Caller } from '../http';

const MAX_LINES = 500;

@Controller({ path: 'logs', version: '1' })
export class LogController {
    constructor(private readonly logs: LogService) {
    }

    @OwnerOnly()
    @Get()
    public latest(@Query('limit', new DefaultValuePipe(200), ParseIntPipe) limit: number): Array<LogLine> {
        return this.logs.latest(Math.min(Math.max(limit, 1), MAX_LINES));
    }

    @Agent()
    @Post()
    @HttpCode(204)
    public addLine(@Body() line: LogLineDto, @CalledBy() caller: Caller): void {
        this.logs.add(caller === 'agent' ? 'agent' : 'phone', line.level, line.message);
    }
}
