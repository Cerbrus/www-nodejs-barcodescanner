import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { ApiModule } from './api/api.module';
import { CoreModule } from './core/core.module';
import { DataModule } from './data/data.module';
import typeorm from './data/typeorm';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [typeorm]
        }),
        ApiModule,
        CoreModule,
        DataModule
    ],
    controllers: [],
    providers: []
})
export class AppModule {
}
