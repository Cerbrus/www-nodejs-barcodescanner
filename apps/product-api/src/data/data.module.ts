import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppConfig } from '../config/app.config';
import { databaseOptions } from './database';
import { Entities } from './entities';
import { TransactionRunner } from './transaction.runner';

@Module({
    imports: [
        TypeOrmModule.forRootAsync({
            inject: [AppConfig],
            useFactory: (config: AppConfig) => databaseOptions(config.databasePath)
        }),
        TypeOrmModule.forFeature(Entities)
    ],
    providers: [TransactionRunner],
    exports: [TypeOrmModule, TransactionRunner]
})
export class DataModule {}
