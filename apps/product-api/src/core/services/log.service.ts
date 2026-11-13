import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync } from 'fs';
import { dirname } from 'path';

import { ConsoleLogger, Injectable } from '@nestjs/common';

import { EventsService } from './events.service';

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
const MAX_FILE_BYTES = 256 * 1024;
const MAX_OLD_FILES = 3;
const STARTUP_NOISE = ['RouterExplorer', 'RoutesResolver', 'InstanceLoader'];

class LogBuffer {
    private readonly lines: Array<LogLine> = [];
    private nextId = 1;
    private listener?: (line: LogLine) => void;
    private fileBytes = 0;
    private file = '';
    private fileUsable = false;

    public open(file: string): void {
        this.file = file;
        this.fileUsable = true;
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
            mkdirSync(dirname(this.file), { recursive: true });
            const text = [`${this.file}.1`, this.file]
                .filter((file) => existsSync(file))
                .map((file) => readFileSync(file, 'utf-8'))
                .join('');
            for (const row of text.split('\n').filter(Boolean).slice(-MAX_LINES)) {
                const { time, source, level, message } = JSON.parse(row) as LogLine;
                this.lines.push({ id: this.nextId++, time, source, level, message });
            }
            this.fileBytes = existsSync(this.file) ? statSync(this.file).size : 0;
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
            appendFileSync(this.file, row);
            this.fileBytes += Buffer.byteLength(row);
        } catch {
            this.fileUsable = false;
        }
    }

    private rotate(): void {
        rmSync(`${this.file}.${MAX_OLD_FILES}`, { force: true });
        for (let index = MAX_OLD_FILES - 1; index >= 1; index--) {
            if (existsSync(`${this.file}.${index}`)) {
                renameSync(`${this.file}.${index}`, `${this.file}.${index + 1}`);
            }
        }
        renameSync(this.file, `${this.file}.1`);
        this.fileBytes = 0;
    }
}

export const logBuffer = new LogBuffer();

export class BufferedLogger extends ConsoleLogger {
    constructor(logFile: string) {
        super();
        logBuffer.open(logFile);
    }

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
