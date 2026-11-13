import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { AppConfig } from '../../config/app.config';
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
    constructor(
        private readonly dataSource: DataSource,
        private readonly config: AppConfig
    ) {
    }

    @Get()
    public async check(): Promise<HealthDto> {
        await this.dataSource.query('SELECT 1');
        return { status: 'ok', version: this.config.version, commit: this.config.commit, builtAt: this.config.builtAt };
    }
}
