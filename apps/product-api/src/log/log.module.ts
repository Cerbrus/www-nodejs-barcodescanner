import { Body, Controller, DefaultValuePipe, Get, HttpCode, Module, ParseIntPipe, Post, Query } from '@nestjs/common';
import { IsIn, IsString, MaxLength } from 'class-validator';

import { LogLevel, LogLine, LogService } from './log.service';
import { EventsModule } from '../events/events.module';

const MAX_LINES = 500;

export class AgentLogDto {
    @IsIn(['debug', 'info', 'warning', 'error'])
    public level: LogLevel;

    @IsString()
    @MaxLength(500)
    public message: string;
}

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
    public addAgentLine(@Body() line: AgentLogDto): void {
        this.logs.add('agent', line.level, line.message);
    }
}

@Module({
    imports: [EventsModule],
    controllers: [LogController],
    providers: [LogService]
})
export class LogModule {
}
