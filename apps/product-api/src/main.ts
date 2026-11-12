import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { BufferedLogger } from './log/log.service';

const logger = new Logger('Main');
const globalPrefix = 'api';
const defaultPort = 3020;

async function bootstrap(): Promise<void> {
    const app = await NestFactory.create(AppModule, {
        cors: process.env['ENVIRONMENT'] === 'development',
        logger: new BufferedLogger()
    });

    app.setGlobalPrefix(globalPrefix);
    app.enableVersioning({ type: VersioningType.URI });
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    app.enableShutdownHooks();

    const port = process.env['PORT'] ?? defaultPort;
    await app.listen(port);
    logger.log(`Listening on port ${port}, API under /${globalPrefix}, version ${process.env['APP_VERSION'] ?? 'dev'} (${process.env['APP_COMMIT']?.slice(0, 7) ?? 'local'})`);
}

bootstrap();
