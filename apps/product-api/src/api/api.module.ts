import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { CoreModule } from '../core/core.module';
import { AgentController } from './controllers/agent.controller';
import { AuthController } from './controllers/auth.controller';
import { BarcodeController } from './controllers/barcode.controller';
import { CatalogController } from './controllers/catalog.controller';
import { ContentPolicyController } from './controllers/content-policy.controller';
import { EventController } from './controllers/event.controller';
import { FeedbackController } from './controllers/feedback.controller';
import { HealthController } from './controllers/health.controller';
import { IconController } from './controllers/icon.controller';
import { ListController } from './controllers/list.controller';
import { LogController } from './controllers/log.controller';
import { PushController } from './controllers/push.controller';
import { RecipeController } from './controllers/recipe.controller';
import { RemarkController } from './controllers/remark.controller';
import { ScanController } from './controllers/scan.controller';
import { SectionController } from './controllers/section.controller';
import { ShoppingModeController } from './controllers/shopping-mode.controller';
import { AuthGuard } from './guards/auth.guard';

@Module({
    imports: [CoreModule],
    controllers: [
        AgentController,
        AuthController,
        BarcodeController,
        CatalogController,
        ContentPolicyController,
        EventController,
        FeedbackController,
        HealthController,
        IconController,
        ListController,
        LogController,
        PushController,
        RecipeController,
        RemarkController,
        ScanController,
        SectionController,
        ShoppingModeController
    ],
    providers: [AuthGuard, { provide: APP_GUARD, useExisting: AuthGuard }]
})
export class ApiModule {}
