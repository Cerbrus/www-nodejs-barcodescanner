import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AgentController } from './controllers/agent.controller';
import { AuthController } from './controllers/auth.controller';
import { BarcodeController } from './controllers/barcode.controller';
import { CatalogController } from './controllers/catalog.controller';
import { EventController } from './controllers/event.controller';
import { FeedbackController } from './controllers/feedback.controller';
import { HealthController } from './controllers/health.controller';
import { IconController } from './controllers/icon.controller';
import { ListController } from './controllers/list.controller';
import { LogController } from './controllers/log.controller';
import { PushController } from './controllers/push.controller';
import { ScanController } from './controllers/scan.controller';
import { SectionController } from './controllers/section.controller';
import { AuthGuard } from './guards/auth.guard';
import { CoreModule } from '../core/core.module';

@Module({
    imports: [CoreModule],
    controllers: [
        AgentController,
        AuthController,
        BarcodeController,
        CatalogController,
        EventController,
        FeedbackController,
        HealthController,
        IconController,
        ListController,
        LogController,
        PushController,
        ScanController,
        SectionController
    ],
    providers: [AuthGuard, { provide: APP_GUARD, useExisting: AuthGuard }]
})
export class ApiModule {
}
