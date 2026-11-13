import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { Public } from '../guards/public.decorator';

interface HealthDto {
    status: 'ok';
    version: string;
    commit?: string;
    builtAt?: string;
}

@Public()
@Controller({ path: 'health', version: '1' })
export class HealthController {
    constructor(private readonly dataSource: DataSource) {
    }

    @Get()
    public async check(): Promise<HealthDto> {
        await this.dataSource.query('SELECT 1');
        return {
            status: 'ok',
            version: process.env['APP_VERSION'] ?? 'dev',
            commit: process.env['APP_COMMIT'] || undefined,
            builtAt: process.env['APP_BUILT'] || undefined
        };
    }
}
