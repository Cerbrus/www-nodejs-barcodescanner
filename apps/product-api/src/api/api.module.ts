import { Module } from '@nestjs/common';
import { CoreModule } from '../core/core.module';
import { HttpModule } from '@nestjs/axios';
import { TerminusModule } from '@nestjs/terminus';
import { BarcodeController, TestController } from './controllers';

// import { ProductController, BarcodeController } from './controllers';

@Module({
    imports: [
        TerminusModule,
        CoreModule,
        HttpModule
    ],
    controllers: [
        TestController,
        // ProductController,
        BarcodeController
    ],
    providers: []
})
export class ApiModule {
}
