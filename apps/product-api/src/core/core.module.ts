import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { DataModule } from '../data/data.module';
import { GetProductHandler, ListProductHandler } from './handlers/query';
import { AHConnector, JumboConnector } from './services/connectors';
// import { ProductService } from './services/product.service';

const CommandHandlers = [];
const QueryHandlers = [
    GetProductHandler,
    ListProductHandler
];
const Services = [
    AHConnector,
    JumboConnector
];

@Module({
    imports: [
        DataModule,
        HttpModule
    ],
    exports: [
        ...Services
    ],
    providers: [
        ...Services,
        ...CommandHandlers,
        ...QueryHandlers
    ]
})
export class CoreModule {
}
