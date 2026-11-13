import { join } from 'path';

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { databaseOptions } from './database';
import { Entities } from './entities';

@Module({
    imports: [
        TypeOrmModule.forRootAsync({
            useFactory: () => databaseOptions(process.env['DATABASE_PATH'] ?? join(process.cwd(), 'data', 'app.db'))
        }),
        TypeOrmModule.forFeature(Entities)
    ],
    exports: [TypeOrmModule]
})
export class DataModule {
}
