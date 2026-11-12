import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
    AxiosExceptionFilter,
    HttpExceptionFilter,
    MissingEntityExceptionFilter,
    UnknownErrorFilter,
    ValidationExceptionFilter
} from './api/exception-filters';

const logger = new Logger('Main');

async function bootstrap(): Promise<void> {
    const app = await NestFactory.create(AppModule, {
        cors: {
            origin: '*',
            methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
            preflightContinue: false,
            optionsSuccessStatus: 204
            // exposedHeaders: ['X-Pagination-Total', 'X-Pagination-Start', 'X-Pagination-Step']
        }
    });

    // Set global API prefix
    const globalPrefix = 'api';
    app.setGlobalPrefix(globalPrefix);

    // Set global pipes
    app.useGlobalPipes(new ValidationPipe({ transform: true }));

    app.useGlobalFilters(
        ...[
            new UnknownErrorFilter(), // Catch all exception filter should be the first handler
            new HttpExceptionFilter(),
            new AxiosExceptionFilter(),
            new MissingEntityExceptionFilter(),
            new ValidationExceptionFilter()
        ]);

    // Set port for API
    const port = process.env['PORT'] || 3020;

    // Add versioning to the API.
    app.enableVersioning({
        type: VersioningType.URI
    });

    await app.listen(port);
    logger.log(`🚀 Application is running on: http://localhost:${port}/${globalPrefix}`);
}

bootstrap();
