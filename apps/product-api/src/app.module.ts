import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';

import { ApiModule } from './api/api.module';
import { setSecurityHeaders } from './api/security-headers';
import { AppConfig } from './config/app.config';
import { AppConfigModule } from './config/config.module';
import { CoreModule } from './core/core.module';
import { DataModule } from './data/data.module';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        AppConfigModule,
        ServeStaticModule.forRootAsync({
            inject: [AppConfig],
            useFactory: (config: AppConfig) => [
                {
                    rootPath: config.iconsPath,
                    serveRoot: '/icons',
                    serveStaticOptions: { fallthrough: false, maxAge: '7d', setHeaders: setSecurityHeaders }
                },
                {
                    rootPath: config.frontendPath,
                    exclude: ['/api/{*path}', '/icons/{*path}'],
                    serveStaticOptions: { setHeaders: setSecurityHeaders }
                }
            ]
        }),
        DataModule,
        CoreModule,
        ApiModule
    ]
})
export class AppModule {
}
