import { join } from 'path';

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CatalogModule } from './catalog/catalog.module';
import { databaseOptions } from './data/database';
import { SeedService } from './data/seed.service';
import { EventsModule } from './events/events.module';
import { HealthController } from './health/health.controller';
import { ListModule } from './list/list.module';
import { LogModule } from './log/log.module';
import { ScanModule } from './scan/scan.module';

const databasePath = process.env['DATABASE_PATH'] ?? join(process.cwd(), 'data', 'app.db');
const frontendPath = process.env['FRONTEND_PATH'] ?? join(__dirname, 'public');
const iconsPath = process.env['ICONS_PATH'] ?? join(process.cwd(), 'data', 'icons');

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot(databaseOptions(databasePath)),
        ServeStaticModule.forRoot(
            {
                rootPath: iconsPath,
                serveRoot: '/icons',
                serveStaticOptions: { fallthrough: false, maxAge: '7d' }
            },
            {
                rootPath: frontendPath,
                exclude: ['/api/{*path}', '/icons/{*path}']
            }
        ),
        EventsModule,
        LogModule,
        ListModule,
        ScanModule,
        CatalogModule
    ],
    controllers: [HealthController],
    providers: [SeedService]
})
export class AppModule {
}
