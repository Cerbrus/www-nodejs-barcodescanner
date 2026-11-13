import { join } from 'path';

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';

import { ApiModule } from './api/api.module';
import { AppConfigModule } from './config/config.module';
import { CoreModule } from './core/core.module';
import { DataModule } from './data/data.module';

const frontendPath = process.env['FRONTEND_PATH'] ?? join(__dirname, 'public');
const iconsPath = process.env['ICONS_PATH'] ?? join(process.cwd(), 'data', 'icons');

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
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
        AppConfigModule,
        DataModule,
        CoreModule,
        ApiModule
    ]
})
export class AppModule {
}
