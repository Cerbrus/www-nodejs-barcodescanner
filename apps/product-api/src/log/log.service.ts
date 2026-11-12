import { ConsoleLogger, Injectable } from '@nestjs/common';

import { EventsService } from '../events/events.service';

export type LogLevel = 'debug' | 'info' | 'warning' | 'error';
export type LogSource = 'app' | 'agent';

export interface LogLine {
    id: number;
    time: string;
    source: LogSource;
    level: LogLevel;
    message: string;
}

const MAX_LINES = 500;
const STARTUP_NOISE = ['RouterExplorer', 'RoutesResolver', 'InstanceLoader'];

class LogBuffer {
    private readonly lines: Array<LogLine> = [];
    private nextId = 1;
    private listener?: (line: LogLine) => void;

    public add(source: LogSource, level: LogLevel, message: string): void {
        const line = { id: this.nextId++, time: new Date().toISOString(), source, level, message };
        this.lines.push(line);
        if (this.lines.length > MAX_LINES) {
            this.lines.shift();
        }
        this.listener?.(line);
    }

    public latest(limit: number): Array<LogLine> {
        return this.lines.slice(-limit);
    }

    public onLine(listener: (line: LogLine) => void): void {
        this.listener = listener;
    }
}

export const logBuffer = new LogBuffer();

export class BufferedLogger extends ConsoleLogger {
    public override log(message: unknown, ...rest: Array<unknown>): void {
        super.log(message, ...rest);
        if (!STARTUP_NOISE.includes(String(rest.at(-1)))) {
            logBuffer.add('app', 'info', this.describe(message, rest));
        }
    }

    public override warn(message: unknown, ...rest: Array<unknown>): void {
        super.warn(message, ...rest);
        logBuffer.add('app', 'warning', this.describe(message, rest));
    }

    public override error(message: unknown, ...rest: Array<unknown>): void {
        super.error(message, ...rest);
        logBuffer.add('app', 'error', this.describe(message, rest));
    }

    private describe(message: unknown, rest: Array<unknown>): string {
        const context = rest.at(-1);
        return typeof context === 'string' ? `[${context}] ${message}` : String(message);
    }
}

@Injectable()
export class LogService {
    constructor(events: EventsService) {
        logBuffer.onLine((line) => events.emit('log', line));
    }

    public add(source: LogSource, level: LogLevel, message: string): void {
        logBuffer.add(source, level, message);
    }

    public latest(limit: number): Array<LogLine> {
        return logBuffer.latest(limit);
    }
}
