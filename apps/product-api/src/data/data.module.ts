import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { databaseOptions } from './database';
import { Entities } from './entities';
import { AppConfig } from '../config/app.config';

@Module({
    imports: [
        TypeOrmModule.forRootAsync({
            inject: [AppConfig],
            useFactory: (config: AppConfig) => databaseOptions(config.databasePath)
        }),
        TypeOrmModule.forFeature(Entities)
    ],
    exports: [TypeOrmModule]
})
export class DataModule {
}
