import { Module } from '@nestjs/common';

import { AHConnector } from './connectors/ah.connector';
import { OpenFoodFactsConnector } from './connectors/off.connector';
import { CatalogService } from './services/catalog.service';
import { ConnectorService } from './services/connector.service';
import { EventsService } from './services/events.service';
import { FeedbackService } from './services/feedback.service';
import { ListService } from './services/list.service';
import { LogService } from './services/log.service';
import { PushService } from './services/push.service';
import { ScanService } from './services/scan.service';
import { SeedService } from './services/seed.service';
import { DataModule } from '../data/data.module';

const services = [
    CatalogService,
    ConnectorService,
    EventsService,
    FeedbackService,
    ListService,
    LogService,
    PushService,
    ScanService,
    SeedService
];

@Module({
    imports: [DataModule],
    providers: [AHConnector, OpenFoodFactsConnector, ...services],
    exports: services
})
export class CoreModule {
}
