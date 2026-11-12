import * as path from 'path';
import process from 'process';

import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import dotenv from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

import { Entities, Migrations } from './data.module';

const configurationToken = 'typeorm';
const development = 'development';
const databaseType = 'postgres' as const;

if (process.env['DATABASE_NAME'] === undefined) {
    // When file is referenced through typeorm cli (e.g. to manage migrations),
    // the .env file will not be loaded. Therefore, load manually.
    dotenv.config({ path: path.resolve(__dirname, '../../.env') });
}

const config: TypeOrmModuleOptions = {
    type: databaseType,
    host: process.env['DATABASE_HOST'],
    port: parseInt(process.env['DATABASE_PORT'] ?? '5432'),
    username: process.env['DATABASE_USERNAME'],
    password: process.env['DATABASE_PASSWORD'],
    database: process.env['DATABASE_NAME'],
    entities: [...Entities],
    migrations: [...Migrations],
    ssl: process.env['ENVIRONMENT'] !== development,
    migrationsRun: true,
    synchronize: false,
    namingStrategy: new SnakeNamingStrategy(),
    applicationName: process.env['DATABASE_NAME'],
    extra: {
        max: 20, // Maximum number of connections in the pool
    },
};

export default registerAs(configurationToken, () => config);

// Unreferenced but needed by typeorm: do not delete.
export const connectionSource = new DataSource(config as DataSourceOptions);
