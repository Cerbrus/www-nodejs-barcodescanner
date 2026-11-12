import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TransactionRunner } from './transaction.runner';
import { BarcodeEntity, ProductEntity, StoreProductEntity } from './entities';
import { BarcodeRepository, ProductRepository } from './repositories';
import { InitialSetup1760897692333 } from './migrations';

const typeormPropertyPath = 'typeorm';

export const Migrations = [InitialSetup1760897692333];
export const Entities = [BarcodeEntity, ProductEntity, StoreProductEntity];

const Repositories = [
    BarcodeRepository, ProductRepository
];

@Module({
    imports: [
        TypeOrmModule.forRootAsync({
            inject: [ConfigService],
            useFactory: async (configService: ConfigService) => configService.get(typeormPropertyPath)!
        }),
        TypeOrmModule.forFeature([...Entities])
    ],
    providers: [...Repositories, TransactionRunner],
    exports: [...Repositories, TransactionRunner]
})
export class DataModule {
}
