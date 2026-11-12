import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync } from 'fs';
import { dirname, join } from 'path';

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
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_OLD_FILES = 5;
const LOG_FILE = process.env['LOG_PATH'] ?? join(dirname(process.env['DATABASE_PATH'] ?? join(process.cwd(), 'data', 'app.db')), 'logs', 'app.log');
const STARTUP_NOISE = ['RouterExplorer', 'RoutesResolver', 'InstanceLoader'];

class LogBuffer {
    private readonly lines: Array<LogLine> = [];
    private nextId = 1;
    private listener?: (line: LogLine) => void;
    private fileBytes = 0;
    private fileUsable = true;

    constructor() {
        this.restore();
    }

    public add(source: LogSource, level: LogLevel, message: string): void {
        const line = { id: this.nextId++, time: new Date().toISOString(), source, level, message };
        this.lines.push(line);
        if (this.lines.length > MAX_LINES) {
            this.lines.shift();
        }
        this.persist(line);
        this.listener?.(line);
    }

    public latest(limit: number): Array<LogLine> {
        return this.lines.slice(-limit);
    }

    public onLine(listener: (line: LogLine) => void): void {
        this.listener = listener;
    }

    private restore(): void {
        try {
            mkdirSync(dirname(LOG_FILE), { recursive: true });
            const text = [`${LOG_FILE}.1`, LOG_FILE]
                .filter((file) => existsSync(file))
                .map((file) => readFileSync(file, 'utf-8'))
                .join('');
            for (const row of text.split('\n').filter(Boolean).slice(-MAX_LINES)) {
                const { time, source, level, message } = JSON.parse(row) as LogLine;
                this.lines.push({ id: this.nextId++, time, source, level, message });
            }
            this.fileBytes = existsSync(LOG_FILE) ? statSync(LOG_FILE).size : 0;
        } catch {
            this.fileUsable = false;
        }
    }

    private persist(line: LogLine): void {
        if (!this.fileUsable) {
            return;
        }

        try {
            const { time, source, level, message } = line;
            const row = `${JSON.stringify({ time, source, level, message })}\n`;
            if (this.fileBytes + Buffer.byteLength(row) > MAX_FILE_BYTES) {
                this.rotate();
            }
            appendFileSync(LOG_FILE, row);
            this.fileBytes += Buffer.byteLength(row);
        } catch {
            this.fileUsable = false;
        }
    }

    private rotate(): void {
        rmSync(`${LOG_FILE}.${MAX_OLD_FILES}`, { force: true });
        for (let index = MAX_OLD_FILES - 1; index >= 1; index--) {
            if (existsSync(`${LOG_FILE}.${index}`)) {
                renameSync(`${LOG_FILE}.${index}`, `${LOG_FILE}.${index + 1}`);
            }
        }
        renameSync(LOG_FILE, `${LOG_FILE}.1`);
        this.fileBytes = 0;
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
