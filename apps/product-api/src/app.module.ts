import { join } from 'path';

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { TypeOrmModule } from '@nestjs/typeorm';
import Database from 'better-sqlite3';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

import { HealthController } from './health/health.controller';

const databasePath = process.env['DATABASE_PATH'] ?? join(process.cwd(), 'data', 'app.db');
const frontendPath = process.env['FRONTEND_PATH'] ?? join(__dirname, 'public');

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot({
            type: 'better-sqlite3',
            driver: Database,
            database: databasePath,
            entities: [],
            migrations: [],
            migrationsRun: true,
            synchronize: false,
            namingStrategy: new SnakeNamingStrategy()
        }),
        ServeStaticModule.forRoot({
            rootPath: frontendPath,
            exclude: ['/api/{*path}']
        })
    ],
    controllers: [HealthController]
})
export class AppModule {
}
