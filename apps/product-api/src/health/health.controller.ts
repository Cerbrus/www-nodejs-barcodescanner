import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';

interface HealthDto {
    status: 'ok';
    version: string;
}

@Controller({ path: 'health', version: '1' })
export class HealthController {
    constructor(private readonly dataSource: DataSource) {
    }

    @Get()
    public async check(): Promise<HealthDto> {
        await this.dataSource.query('SELECT 1');
        return { status: 'ok', version: process.env['APP_VERSION'] ?? 'dev' };
    }
}
