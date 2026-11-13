import { Body, Controller, DefaultValuePipe, Get, HttpCode, ParseIntPipe, Post, Query } from '@nestjs/common';

import { LogLine, LogService } from '../../core/services/log.service';
import { LogLineDto } from '../dto/log-line.dto';

const MAX_LINES = 500;

@Controller({ path: 'logs', version: '1' })
export class LogController {
    constructor(private readonly logs: LogService) {
    }

    @Get()
    public latest(@Query('limit', new DefaultValuePipe(200), ParseIntPipe) limit: number): Array<LogLine> {
        return this.logs.latest(Math.min(Math.max(limit, 1), MAX_LINES));
    }

    @Post()
    @HttpCode(204)
    public addAgentLine(@Body() line: LogLineDto): void {
        this.logs.add('agent', line.level, line.message);
    }
}
